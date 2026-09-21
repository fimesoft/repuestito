'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrders, confirmOrderAndGenerateInvoice, cancelOrder, Order } from '@/services/orders.service';
import styles from './page.module.css';
import Table, { Column } from '@/components/ui/Table';
import Filters from '@/components/shared/Filters';
import { formatDateTime } from '@/lib/date';
import EmptyState from '@/components/shared/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import PageCount from '@/components/shared/PageCount';
import Paginator from '@/components/ui/Paginator';
import Loading from '@/components/ui/Loading';
import Dropdown from '@/components/ui/Dropdown';
import Confirm from '@/components/shared/Confirm';

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
  const router = useRouter();
  const { currentUser, loading: permissionsLoading } = usePermissions();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [orderToConfirm, setOrderToConfirm] = useState<Order | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const debouncedSearch = useDebounce(search, 600);

  const visibleOrders = orders.filter(o => {
    const fullName = [o.buyerName, o.buyerLastname].filter(Boolean).join(' ').toLowerCase();
    return !debouncedSearch || fullName.includes(debouncedSearch.toLowerCase());
  });

  const hasFilters = Boolean(debouncedSearch || statusFilter);

  const load = useCallback(async (p: number) => {
    if (!currentUser?.tenantId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await getOrders({
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

  async function handleConfirm() {
    if (!currentUser?.tenantId || !orderToConfirm) return;
    setConfirming(true);
    try {
      const updated = await confirmOrderAndGenerateInvoice(orderToConfirm.id);
      setOrders(prev => prev.map(o => o.id === orderToConfirm.id ? updated : o));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al confirmar y generar la factura');
      throw err;
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!currentUser?.tenantId || !orderToCancel) return;
    setCancelling(true);
    try {
      const updated = await cancelOrder(orderToCancel.id);
      setOrders(prev => prev.map(o => o.id === orderToCancel.id ? updated : o));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cancelar');
      throw err;
    } finally {
      setCancelling(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Breadcrumbs items={[{ label: 'Pedidos' }]} />
          <MainTitle title="Pedidos" subtitle="Gestión de órdenes de compra" />
        </div>
        <Link href="/dashboard/orders/new" className={styles.btnNew}>+ Nuevo pedido</Link>
      </div>

      <Filters
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar por comprador...' }}
        selects={[{
          label: 'Estado',
          value: statusFilter,
          onChange: setStatusFilter,
          placeholder: 'Todos',
          options: [
            { value: 'pending', label: 'Pendiente' },
            { value: 'confirmed', label: 'Confirmado' },
            { value: 'fulfilled', label: 'Facturado' },
            { value: 'cancelled', label: 'Cancelado' },
          ],
        }]}
      />

      <div className={styles.subControls}>
        <PageCount total={total} limit={limit} onLimitChange={next => { setLimit(next); setPage(1); void load(1); }} />
      </div>

      {loading ? <Loading variant="orbit" /> : <Table<Order>
        rows={visibleOrders}
        getKey={o => o.id}
        onRowClick={o => router.push(`/dashboard/orders/${o.id}`)}
        emptyMessage={error ? (
          <EmptyState variant="error" description={error} />
        ) : (
          <EmptyState
            variant={hasFilters ? 'no-results' : 'empty'}
            title={hasFilters ? 'Sin pedidos para tu búsqueda' : 'No hay pedidos registrados'}
            description={hasFilters
              ? 'No encontramos pedidos que coincidan con los filtros aplicados. Probá ajustarlos.'
              : 'Aún no tienes ventas registradas. Cuando ingresen, aparecerán aquí.'}
            illustration="orders"
          />
        )}
        columns={[
          { header: 'Número', render: o => o.orderNumber ?? '—', className: styles.tdNumber },
          { header: 'Comprador', render: o => [o.buyerName, o.buyerLastname].filter(Boolean).join(' ') || '—', className: styles.tdMeta },
          { header: 'Total', render: o => `$${Number(o.total).toFixed(2)}`, className: styles.tdPrice },
          { header: 'Estado', render: o => <Badge label={STATUS_LABELS[o.status] ?? o.status} variant={STATUS_VARIANT[o.status] ?? 'neutral'} /> },
          { header: 'Fecha', render: o => o.createdAt ? formatDateTime(o.createdAt) : '—', className: styles.tdMeta },
          { header: '', render: o => (
            <div onClick={event => event.stopPropagation()}>
              <Dropdown items={[
                { label: 'Ver', onClick: () => router.push(`/dashboard/orders/${o.id}`), icon: '/icons/eye.svg' },
                ...(o.status === 'pending' ? [{ label: 'Confirmar', onClick: () => setOrderToConfirm(o), icon: '/icons/check.svg' }] : []),
                ...(o.status === 'pending' || o.status === 'confirmed' ? [{ label: 'Cancelar', onClick: () => setOrderToCancel(o), variant: 'danger' as const, icon: '/icons/cancel.svg' }] : []),
              ]} />
            </div>
          ), className: styles.tdActions },
        ] as Column<Order>[]}
      />}

      {totalPages > 1 && (
        <Paginator currentPage={page} totalPages={totalPages} onPageChange={p => { setPage(p); void load(p); }} />
      )}

      <Confirm
        isOpen={orderToConfirm !== null}
        onClose={() => setOrderToConfirm(null)}
        onConfirm={handleConfirm}
        isLoading={confirming}
        message={`¿Estás seguro de que querés confirmar el pedido ${orderToConfirm?.orderNumber ?? ''}? La factura se generará automáticamente.`}
        confirmLabel="Confirmar y facturar"
        loadingLabel="Generando factura…"
        successMessage="El pedido fue confirmado y la factura se generó correctamente."
      />

      <Confirm
        isOpen={orderToCancel !== null}
        onClose={() => setOrderToCancel(null)}
        onConfirm={handleCancel}
        isLoading={cancelling}
        title="Cancelar pedido"
        message={`¿Estás seguro de que querés cancelar el pedido ${orderToCancel?.orderNumber ?? ''}? Se restaurará el stock.`}
        confirmLabel="Cancelar pedido"
        loadingLabel="Cancelando…"
        confirmColor="danger"
        successMessage="El pedido fue cancelado y el stock fue restaurado."
      />
    </main>
  );
}
