'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrders, confirmOrder, cancelOrder, Order } from '@/services/orders.service';
import styles from './page.module.css';

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
        <label className={styles.filterLabel}>
          Estado
          <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="fulfilled">Facturado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Número</th>
              <th>Comprador</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className={styles.empty}>Cargando...</td></tr>
            )}
            {!loading && orders.map(order => (
              <tr key={order.id}>
                <td className={styles.tdNumber}>{order.orderNumber ?? '—'}</td>
                <td className={styles.tdMeta}>
                  {[order.buyerName, order.buyerLastname].filter(Boolean).join(' ') || '—'}
                </td>
                <td className={styles.tdPrice}>${Number(order.total).toFixed(2)}</td>
                <td>
                  <span className={`${styles.badge} ${STATUS_BADGE[order.status] ?? ''}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </td>
                <td className={styles.tdMeta}>
                  {order.createdAt ? new Date(order.createdAt).toLocaleString('es-AR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    hour12: true,
                  }) : '—'}
                </td>
                <td className={styles.tdActions}>
                  <Link
                    href={`/dashboard/orders/${order.id}?tenantId=${currentUser?.tenantId ?? ''}`}
                    className={styles.btnText}
                  >
                    Ver
                  </Link>
                  {order.status === 'pending' && (
                    <button className={styles.btnAction} onClick={() => handleConfirm(order.id)}>
                      Confirmar
                    </button>
                  )}
                  {(order.status === 'pending' || order.status === 'confirmed') && (
                    <button className={styles.btnDanger} onClick={() => handleCancel(order.id)}>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={6} className={styles.empty}>No hay pedidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); void load(p); }}
          >
            ← Anterior
          </button>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => { const p = page + 1; setPage(p); void load(p); }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </main>
  );
}
