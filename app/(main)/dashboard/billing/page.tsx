'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
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
import Dropdown from '@/components/ui/Dropdown';

const DEFAULT_LIMIT = 20;

export default function BillingPage() {
  const { currentUser, loading: permissionsLoading } = usePermissions();

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
    if (!currentUser?.tenantId) { setLoading(false); return; }
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
    if (permissionsLoading) return;
    void load(1);
    setPage(1);
  }, [load, permissionsLoading]);

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
          <Breadcrumbs items={[{ label: 'Facturación' }]} />
          <MainTitle title="Facturación" subtitle="Registro de ventas y emisión de facturas" />
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

      {loading ? <Loading /> : <Table<Invoice>
        rows={visibleInvoices}
        getKey={inv => inv.id}
        emptyMessage={error ? (
          <EmptyState variant="error" description={error} />
        ) : (
          <EmptyState
            variant={debouncedSearch || statusFilter ? 'no-results' : 'empty'}
            title={debouncedSearch || statusFilter ? 'Sin facturas para tu búsqueda' : 'No hay facturas registradas'}
            description={debouncedSearch || statusFilter
              ? 'No encontramos facturas que coincidan con tu búsqueda o filtros. Probá con otros términos.'
              : 'Aún no tienes facturas generadas. Cuando se emitan, aparecerán aquí.'}
            illustration="orders"
          />
        )}
        columns={[
          { header: 'Número', render: inv => inv.invoiceNumber ?? '—', className: styles.tdNumber },
          { header: 'Comprador', render: inv => [inv.buyerName, inv.buyerLastname].filter(Boolean).join(' ') || '—', className: styles.tdMeta },
          { header: 'Total', render: inv => `$${Number(inv.total).toFixed(2)}`, className: styles.tdPrice },
          { header: 'Pago', render: inv => inv.paymentMethod, className: styles.tdMeta },
          { header: 'Estado', render: inv => <Badge label={inv.status === 'cancelled' ? 'Cancelada' : 'Completada'} variant={inv.status === 'cancelled' ? 'inactive' : 'active'} /> },
          { header: 'Fecha', render: inv => inv.issuedAt ? formatDateTime(inv.issuedAt) : '—', className: styles.tdMeta },
          { header: '', render: inv => (
            <Dropdown items={[
              { label: 'Ver', onClick: () => window.location.href = `/dashboard/billing/${inv.id}?tenantId=${currentUser?.tenantId ?? ''}`, icon: '/icons/eye.svg' },
              ...(inv.status !== 'cancelled' ? [{ label: 'Cancelar', onClick: () => handleCancel(inv.id), variant: 'danger' as const, icon: '/icons/cancel.svg' }] : []),
            ]} />
          ), className: styles.tdActions },
        ] as Column<Invoice>[]}
      />}

      {totalPages > 1 && (
        <Paginator currentPage={page} totalPages={totalPages} onPageChange={p => { setPage(p); void load(p); }} />
      )}
    </main>
  );
}
