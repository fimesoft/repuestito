'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getInvoice, Invoice } from '@/services/billing.service';
import Button from '@/components/ui/Button/Button';
import styles from './page.module.css';
import { formatDateLong } from '@/lib/date';
import Badge from '@/components/ui/Badge';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const tenantId = searchParams.get('tenantId') ?? '';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !tenantId) { setError('Parámetros inválidos'); setLoading(false); return; }
    getInvoice(id, tenantId)
      .then(setInvoice)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar la factura'))
      .finally(() => setLoading(false));
  }, [id, tenantId]);

  if (loading) return <main className={styles.page}><p className={styles.hint}>Cargando...</p></main>;
  if (error) return <main className={styles.page}><p className={styles.error}>{error}</p></main>;
  if (!invoice) return null;

  return (
    <main className={styles.page}>
      <div className={styles.noPrint}>
        <Button label="← Volver" variant="ghost" color="neutral" onClick={() => router.back()} />
        <Button label="Imprimir" variant="outline" color="neutral" onClick={() => window.print()} />
      </div>

      <div className={styles.invoice}>
        <div className={styles.invoiceHeader}>
          <div>
            <h1 className={styles.invoiceTitle}>Factura</h1>
            <p className={styles.invoiceNumber}>{invoice.invoiceNumber}</p>
          </div>
          <div className={styles.invoiceMeta}>
            <p className={styles.metaDate}>{formatDateLong(invoice.issuedAt)}</p>
            <Badge label={invoice.status === 'cancelled' ? 'Cancelada' : 'Completada'} variant={invoice.status === 'cancelled' ? 'inactive' : 'active'} />
          </div>
        </div>

        {(invoice.buyerName || invoice.buyerDoc || invoice.buyerPhone) && (
          <div className={styles.buyerSection}>
            <h2 className={styles.sectionTitle}>Comprador</h2>
            {invoice.buyerName && <p className={styles.buyerField}>{invoice.buyerName}</p>}
            {invoice.buyerDoc && <p className={styles.buyerField}>Doc: {invoice.buyerDoc}</p>}
            {invoice.buyerPhone && <p className={styles.buyerField}>Tel: {invoice.buyerPhone}</p>}
          </div>
        )}

        {invoice.items && invoice.items.length > 0 && (
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
              {invoice.items.map(item => (
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
          <div className={styles.totalRow}><span>Subtotal</span><span>${Number(invoice.subtotal).toFixed(2)}</span></div>
          <div className={styles.totalRow}><span>IVA ({Number(invoice.taxRate)}%)</span><span>${Number(invoice.taxAmount).toFixed(2)}</span></div>
          <div className={`${styles.totalRow} ${styles.totalFinal}`}><span>Total</span><span>${Number(invoice.total).toFixed(2)}</span></div>
        </div>

        {invoice.notes && (
          <div className={styles.notes}>
            <span className={styles.notesLabel}>Notas:</span> {invoice.notes}
          </div>
        )}

        <div className={styles.paymentRow}>
          Método de pago: <strong>{invoice.paymentMethod}</strong>
        </div>
      </div>
    </main>
  );
}
