'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrders, confirmOrder, cancelOrder, Order } from '@/services/orders.service';
import styles from './page.module.css';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import { formatDateTime } from '@/lib/date';
import Button from '@/components/ui/Button/Button';
import EmptyState from '@/components/shared/EmptyState/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  fulfilled: 'Facturado',
  cancelled: 'Cancelado',
};

const STATUS_BADGE: Record<string, string> = {
  pending: styles.badgePending,
  confirmed: styles.badgeConfirmed,
  fulfilled: styles.badgeFulfilled,
  cancelled: styles.badgeCancelled,
};

export default function OrdersPage() {
  const { currentUser } = usePermissions();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);

  const visibleOrders = orders.filter(o => {
    const fullName = [o.buyerName, o.buyerLastname].filter(Boolean).join(' ').toLowerCase();
    return !debouncedSearch || fullName.includes(debouncedSearch.toLowerCase());
  });

  const load = useCallback(async (p: number) => {
    if (!currentUser?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getOrders({
        tenantId: currentUser.tenantId,
        status: statusFilter || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setOrders(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.tenantId, statusFilter]);

  useEffect(() => {
    void load(1);
    setPage(1);
  }, [load]);

  async function handleConfirm(id: string) {
    if (!currentUser?.tenantId) return;
    try {
      await confirmOrder(id, currentUser.tenantId);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'confirmed' as const } : o));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al confirmar');
    }
  }

  async function handleCancel(id: string) {
    if (!currentUser?.tenantId) return;
    if (!confirm('¿Cancelar este pedido? Se restaurará el stock.')) return;
    try {
      const updated = await cancelOrder(id, currentUser.tenantId);
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cancelar');
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Pedidos</h1>
          <p className={styles.subtitle}>{total} pedidos registrados</p>
        </div>
        <Link href="/dashboard/orders/new" className={styles.btnNew}>+ Nuevo pedido</Link>
      </div>

      <div className={styles.filters}>
        <Search value={search} onChange={setSearch} placeholder="Buscar por comprador..." />
        <label className={styles.filterLabel}>
          Estado
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'pending', label: 'Pendiente' },
              { value: 'confirmed', label: 'Confirmado' },
              { value: 'fulfilled', label: 'Facturado' },
              { value: 'cancelled', label: 'Cancelado' },
            ]}
            placeholder="Todos"
          />
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Table<Order>
        rows={visibleOrders}
        getKey={o => o.id}
        emptyMessage={<EmptyState variant={debouncedSearch ? 'no-results' : 'empty'} />}
        loading={loading}
        columns={[
          { header: 'Número', render: o => o.orderNumber ?? '—', className: styles.tdNumber },
          { header: 'Comprador', render: o => [o.buyerName, o.buyerLastname].filter(Boolean).join(' ') || '—', className: styles.tdMeta },
          { header: 'Total', render: o => `$${Number(o.total).toFixed(2)}`, className: styles.tdPrice },
          { header: 'Estado', render: o => <span className={`${styles.badge} ${STATUS_BADGE[o.status] ?? ''}`}>{STATUS_LABELS[o.status] ?? o.status}</span> },
          { header: 'Fecha', render: o => o.createdAt ? formatDateTime(o.createdAt) : '—', className: styles.tdMeta },
          { header: '', render: o => (
            <>
              <Link href={`/dashboard/orders/${o.id}?tenantId=${currentUser?.tenantId ?? ''}`} className={styles.btnText}>Ver</Link>
              {o.status === 'pending' && <Button label="Confirmar" variant="ghost" color="success" size="sm" onClick={() => handleConfirm(o.id)} />}
              {(o.status === 'pending' || o.status === 'confirmed') && <Button label="Cancelar" variant="ghost" color="danger" size="sm" onClick={() => handleCancel(o.id)} />}
            </>
          ), className: styles.tdActions },
        ] as Column<Order>[]}
      />

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button label="← Anterior" variant="outline" color="neutral" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p); }} />
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <Button label="Siguiente →" variant="outline" color="neutral" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(p); }} />
        </div>
      )}
    </main>
  );
}
