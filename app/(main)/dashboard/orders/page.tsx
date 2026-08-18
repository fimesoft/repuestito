'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import MainTitle from '@/components/shared/MainTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrders, confirmOrder, cancelOrder, Order } from '@/services/orders.service';
import styles from './page.module.css';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import { formatDateTime } from '@/lib/date';
import Button from '@/components/ui/Button/Button';
import EmptyState from '@/components/shared/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import PageCount from '@/components/shared/PageCount';
import Paginator from '@/components/ui/Paginator';
import Loading from '@/components/ui/Loading';
import Dropdown from '@/components/ui/Dropdown';

const DEFAULT_LIMIT = 20;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  fulfilled: 'Facturado',
  cancelled: 'Cancelado',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'info',
  fulfilled: 'active',
  cancelled: 'inactive',
};

export default function OrdersPage() {
  const { currentUser, loading: permissionsLoading } = usePermissions();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);

  const visibleOrders = orders.filter(o => {
    const fullName = [o.buyerName, o.buyerLastname].filter(Boolean).join(' ').toLowerCase();
    return !debouncedSearch || fullName.includes(debouncedSearch.toLowerCase());
  });

  const load = useCallback(async (p: number) => {
    if (!currentUser?.tenantId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await getOrders({
        tenantId: currentUser.tenantId,
        status: statusFilter || undefined,
        page: p,
        limit,
      });
      setOrders(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.tenantId, statusFilter, limit]);

  useEffect(() => {
    if (permissionsLoading) return;
    void load(1);
    setPage(1);
  }, [load, permissionsLoading]);

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

  const totalPages = Math.ceil(total / limit);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <MainTitle title="Pedidos" subtitle="Gestión de órdenes de compra" />
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

      <div className={styles.subControls}>
        <PageCount total={total} limit={limit} onLimitChange={next => { setLimit(next); setPage(1); void load(1); }} />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? <Loading /> : <Table<Order>
        rows={visibleOrders}
        getKey={o => o.id}
        emptyMessage={<EmptyState variant={debouncedSearch ? 'no-results' : 'empty'} />}
        columns={[
          { header: 'Número', render: o => o.orderNumber ?? '—', className: styles.tdNumber },
          { header: 'Comprador', render: o => [o.buyerName, o.buyerLastname].filter(Boolean).join(' ') || '—', className: styles.tdMeta },
          { header: 'Total', render: o => `$${Number(o.total).toFixed(2)}`, className: styles.tdPrice },
          { header: 'Estado', render: o => <Badge label={STATUS_LABELS[o.status] ?? o.status} variant={STATUS_VARIANT[o.status] ?? 'neutral'} /> },
          { header: 'Fecha', render: o => o.createdAt ? formatDateTime(o.createdAt) : '—', className: styles.tdMeta },
          { header: '', render: o => (
            <Dropdown items={[
              { label: 'Ver', onClick: () => window.location.href = `/dashboard/orders/${o.id}?tenantId=${currentUser?.tenantId ?? ''}`, icon: '/icons/eye.svg' },
              ...(o.status === 'pending' ? [{ label: 'Confirmar', onClick: () => handleConfirm(o.id), icon: '/icons/check.svg' }] : []),
              ...(o.status === 'pending' || o.status === 'confirmed' ? [{ label: 'Cancelar', onClick: () => handleCancel(o.id), variant: 'danger' as const, icon: '/icons/cancel.svg' }] : []),
            ]} />
          ), className: styles.tdActions },
        ] as Column<Order>[]}
      />}

      {totalPages > 1 && (
        <Paginator currentPage={page} totalPages={totalPages} onPageChange={p => { setPage(p); void load(p); }} />
      )}
    </main>
  );
}
