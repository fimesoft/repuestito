'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrder, confirmOrder, fulfillOrder, cancelOrder, Order } from '@/services/orders.service';
import Button from '@/components/ui/Button/Button';
import styles from './page.module.css';
import { formatDateLong } from '@/lib/date';

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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = usePermissions();

  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const tenantId = searchParams.get('tenantId') ?? currentUser?.tenantId ?? '';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !tenantId) { setError('Parámetros inválidos'); setLoading(false); return; }
    getOrder(id, tenantId)
      .then(setOrder)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar el pedido'))
      .finally(() => setLoading(false));
  }, [id, tenantId]);

  async function handleConfirm() {
    if (!order) return;
    setActionError(null);
    try {
      await confirmOrder(order.id, tenantId);
      setOrder(prev => prev ? { ...prev, status: 'confirmed' as const } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al confirmar');
    }
  }

  async function handleFulfill() {
    if (!order) return;
    if (!confirm('¿Convertir este pedido a factura? Se generará una invoice.')) return;
    setActionError(null);
    try {
      await fulfillOrder(order.id, tenantId);
      const updated = await getOrder(order.id, tenantId);
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al convertir a factura');
    }
  }

  async function handleCancel() {
    if (!order) return;
    if (!confirm('¿Cancelar este pedido? Se restaurará el stock.')) return;
    setActionError(null);
    try {
      const updated = await cancelOrder(order.id, tenantId);
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al cancelar');
    }
  }

  if (loading) return <main className={styles.page}><p className={styles.hint}>Cargando...</p></main>;
  if (error) return <main className={styles.page}><p className={styles.error}>{error}</p></main>;
  if (!order) return null;

  return (
    <main className={styles.page}>
      <div className={styles.noPrint}>
        <Button label="← Volver" variant="ghost" color="neutral" onClick={() => router.back()} />
        {order.status === 'pending' && (
          <Button label="Confirmar" color="success" onClick={handleConfirm} />
        )}
        {order.status === 'confirmed' && (
          <Button label="Convertir a factura" color="primary" onClick={handleFulfill} />
        )}
        {(order.status === 'pending' || order.status === 'confirmed') && (
          <Button label="Cancelar" variant="outline" color="danger" onClick={handleCancel} />
        )}
      </div>

      {actionError && <p className={styles.error} style={{ marginBottom: '1rem' }}>{actionError}</p>}

      <div className={styles.order}>
        <div className={styles.orderHeader}>
          <div>
            <h1 className={styles.orderTitle}>Pedido</h1>
            <p className={styles.orderNumber}>{order.orderNumber}</p>
          </div>
          <div className={styles.orderMeta}>
            <p className={styles.metaDate}>{formatDateLong(order.createdAt)}</p>
            <span className={`${styles.badge} ${STATUS_BADGE[order.status] ?? ''}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {(order.buyerName || order.buyerDoc || order.buyerPhone) && (
          <div className={styles.buyerSection}>
            <h2 className={styles.sectionTitle}>Comprador</h2>
            {order.buyerName && <p className={styles.buyerField}>{order.buyerName}</p>}
            {order.buyerDoc && <p className={styles.buyerField}>Doc: {order.buyerDoc}</p>}
            {order.buyerPhone && <p className={styles.buyerField}>Tel: {order.buyerPhone}</p>}
          </div>
        )}

        {order.items && order.items.length > 0 && (
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>Descripción</th>
                <th className={styles.right}>Precio unit.</th>
                <th className={styles.right}>Qty</th>
                <th className={styles.right}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td className={styles.right}>${Number(item.unitPrice).toFixed(2)}</td>
                  <td className={styles.right}>{item.quantity}</td>
                  <td className={styles.right}>${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.totals}>
          <div className={styles.totalRow}><span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
          <div className={styles.totalRow}><span>IVA ({Number(order.taxRate)}%)</span><span>${Number(order.taxAmount).toFixed(2)}</span></div>
          <div className={`${styles.totalRow} ${styles.totalFinal}`}><span>Total</span><span>${Number(order.total).toFixed(2)}</span></div>
        </div>

        {order.notes && (
          <div className={styles.notes}>
            <span className={styles.notesLabel}>Notas:</span> {order.notes}
          </div>
        )}

        {order.invoiceId && (
          <Link
            href={`/dashboard/billing/${order.invoiceId}?tenantId=${tenantId}`}
            className={styles.invoiceLink}
          >
            Ver factura generada →
          </Link>
        )}
      </div>
    </main>
  );
}
