'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { getInvoices, cancelInvoice, Invoice } from '@/services/billing.service';
import styles from './page.module.css';

const PAGE_SIZE = 20;

export default function BillingHistoryPage() {
  const { currentUser } = usePermissions();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
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
        limit: PAGE_SIZE,
      });
      setInvoices(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.tenantId, from, to]);

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const visibleInvoices = statusFilter
    ? invoices.filter(inv => inv.status === statusFilter)
    : invoices;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Historial de facturas</h1>
          <p className={styles.subtitle}>{total} facturas registradas</p>
        </div>
        <Link href="/dashboard/billing" className={styles.btnNew}>+ Nueva venta</Link>
      </div>

      <div className={styles.filters}>
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
          <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
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
              <th>Pago</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className={styles.empty}>Cargando...</td></tr>
            )}
            {!loading && visibleInvoices.map(inv => (
              <tr key={inv.id}>
                <td className={styles.tdNumber}>{inv.invoiceNumber}</td>
                <td className={styles.tdMeta}>{inv.buyerName ?? '—'}</td>
                <td className={styles.tdPrice}>${Number(inv.total).toFixed(2)}</td>
                <td className={styles.tdMeta}>{inv.paymentMethod}</td>
                <td>
                  <span className={inv.status === 'cancelled' ? styles.badgeCancelled : styles.badgeCompleted}>
                    {inv.status === 'cancelled' ? 'Cancelada' : 'Completada'}
                  </span>
                </td>
                <td className={styles.tdMeta}>{new Date(inv.issuedAt).toLocaleDateString('es')}</td>
                <td className={styles.tdActions}>
                  <Link
                    href={`/dashboard/billing/${inv.id}?tenantId=${currentUser?.tenantId ?? ''}`}
                    className={styles.btnText}
                  >
                    Ver
                  </Link>
                  {inv.status !== 'cancelled' && (
                    <button className={styles.btnDanger} onClick={() => handleCancel(inv.id)}>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && visibleInvoices.length === 0 && (
              <tr><td colSpan={7} className={styles.empty}>No hay facturas.</td></tr>
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
