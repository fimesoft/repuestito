'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getInvoices, cancelInvoice, Invoice } from '@/services/billing.service';
import styles from './page.module.css';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button/Button';
import { formatDateTime } from '@/lib/date';
import EmptyState from '@/components/shared/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import Badge from '@/components/ui/Badge';
import PageCount from '@/components/shared/PageCount';
import Paginator from '@/components/ui/Paginator';
import Loading from '@/components/ui/Loading';

const DEFAULT_LIMIT = 20;

export default function BillingPage() {
  const { currentUser } = usePermissions();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (p: number) => {
    if (!currentUser?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getInvoices({
        tenantId: currentUser.tenantId,
        from: from || undefined,
        to: to || undefined,
        page: p,
        limit,
      });
      setInvoices(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.tenantId, from, to, limit]);

  useEffect(() => {
    void load(1);
    setPage(1);
  }, [load]);

  async function handleCancel(id: string) {
    if (!currentUser?.tenantId) return;
    if (!confirm('¿Cancelar esta factura? Se restaurará el stock.')) return;
    try {
      const updated = await cancelInvoice(id, currentUser.tenantId);
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cancelar');
    }
  }

  const totalPages = Math.ceil(total / limit);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);

  const visibleInvoices = invoices.filter(inv => {
    const matchesStatus = !statusFilter || inv.status === statusFilter;
    const fullName = [inv.buyerName, inv.buyerLastname].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !debouncedSearch || fullName.includes(debouncedSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Facturación</h1>
          <p className={styles.subtitle}>{total} facturas registradas</p>
        </div>
        <Link href="/dashboard/billing/new" className={styles.btnNew}>+ Nueva venta</Link>
      </div>

      <div className={styles.filters}>
        <Search value={search} onChange={setSearch} placeholder="Buscar por comprador..." />
        <label className={styles.filterLabel}>
          Desde
          <input type="date" className={styles.input} value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className={styles.filterLabel}>
          Hasta
          <input type="date" className={styles.input} value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className={styles.filterLabel}>
          Estado
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: 'completed', label: 'Completada' }, { value: 'cancelled', label: 'Cancelada' }]}
            placeholder="Todos"
          />
        </label>
      </div>

      <div className={styles.subControls}>
        <PageCount total={total} limit={limit} onLimitChange={next => { setLimit(next); setPage(1); void load(1); }} />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? <Loading /> : <Table<Invoice>
        rows={visibleInvoices}
        getKey={inv => inv.id}
        emptyMessage={<EmptyState variant={debouncedSearch || statusFilter ? 'no-results' : 'empty'} />}
        columns={[
          { header: 'Número', render: inv => inv.invoiceNumber ?? '—', className: styles.tdNumber },
          { header: 'Comprador', render: inv => [inv.buyerName, inv.buyerLastname].filter(Boolean).join(' ') || '—', className: styles.tdMeta },
          { header: 'Total', render: inv => `$${Number(inv.total).toFixed(2)}`, className: styles.tdPrice },
          { header: 'Pago', render: inv => inv.paymentMethod, className: styles.tdMeta },
          { header: 'Estado', render: inv => <Badge label={inv.status === 'cancelled' ? 'Cancelada' : 'Completada'} variant={inv.status === 'cancelled' ? 'inactive' : 'active'} /> },
          { header: 'Fecha', render: inv => inv.issuedAt ? formatDateTime(inv.issuedAt) : '—', className: styles.tdMeta },
          { header: '', render: inv => (
            <>
              <Link href={`/dashboard/billing/${inv.id}?tenantId=${currentUser?.tenantId ?? ''}`} className={styles.btnText}>Ver</Link>
              {inv.status !== 'cancelled' && <Button label="Cancelar" variant="ghost" color="danger" size="sm" onClick={() => handleCancel(inv.id)} />}
            </>
          ), className: styles.tdActions },
        ] as Column<Invoice>[]}
      />}

      {totalPages > 1 && (
        <Paginator currentPage={page} totalPages={totalPages} onPageChange={p => { setPage(p); void load(p); }} />
      )}
    </main>
  );
}
