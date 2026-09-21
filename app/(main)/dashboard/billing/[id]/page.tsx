'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getInvoice, Invoice } from '@/services/billing.service';
import BackPage from '@/components/shared/BackPage';
import styles from './page.module.css';

const InvoicePdfViewer = dynamic(() => import('@/components/features/billing/InvoicePdfViewer'), {
  ssr: false,
});

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('Parámetros inválidos'); setLoading(false); return; }
    getInvoice(id)
      .then(setInvoice)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar la factura'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className={styles.page}><p className={styles.hint}>Cargando...</p></main>;
  if (error) return <main className={styles.page}><p className={styles.error}>{error}</p></main>;
  if (!invoice) return null;

  return (
    <main className={styles.page}>
      <div className={styles.noPrint}>
        <BackPage href="/dashboard/billing" />
      </div>

      <InvoicePdfViewer invoice={invoice} />
    </main>
  );
}
