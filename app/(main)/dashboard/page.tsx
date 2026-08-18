'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats, DashboardStats } from '@/services/stats.service';
import Card from '@/components/ui/Card';
import MainTitle from '@/components/shared/MainTitle';
import Loading from '@/components/ui/Loading';
import OrdersChart from '@/components/features/dashboard/OrdersChart';
import styles from './page.module.css';

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </Card>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('No se pudieron cargar las estadísticas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.page}><Loading /></div>;
  if (error || !stats) return <div className={styles.page}><p className={styles.error}>{error}</p></div>;

  return (
    <main className={styles.page}>
      <MainTitle
        title="Dashboard"
        subtitle="Métricas generales del marketplace y control de ventas."
        className={styles.pageTitle}
      />

      <section className={styles.section}>
        <div className={styles.grid}>
          <StatCard label="Total usuarios" value={stats.users.total} />
          <StatCard label="Activos" value={stats.users.active} sub={`${stats.users.total - stats.users.active} inactivos`} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.grid}>
          <StatCard label="Marcas totales" value={stats.brands.total} sub={`${stats.brands.active} activas`} />
          <StatCard label="Repuestos activos" value={stats.replacements.active} />
          <StatCard label="Repuestos inactivos" value={stats.replacements.inactive} />
          <StatCard label="Total repuestos" value={stats.replacements.total} />
          <StatCard label="Valor del inventario" value={formatCurrency(stats.replacements.inventoryValue ?? 0)} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.comercialLayout}>
          <div className={styles.comercialStats}>
            <StatCard label="Pedidos totales" value={stats.orders.total} />
          </div>
          <OrdersChart orders={stats.orders} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.compatRow}>
          <Card className={styles.compatTotal}>
            <span className={styles.statLabel}>Total registradas</span>
            <span className={styles.statValue}>{stats.compatibilities.total}</span>
          </Card>
          <Card className={styles.compatTable}>
            <span className={styles.tableTitle}>Top modelos con más compatibilidades</span>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Compat.</th>
                </tr>
              </thead>
              <tbody>
                {stats.compatibilities.topModels.length === 0 ? (
                  <tr><td colSpan={3} className={styles.empty}>Sin datos aún</td></tr>
                ) : (
                  stats.compatibilities.topModels.map((m, i) => (
                    <tr key={i}>
                      <td>{m.brand}</td>
                      <td>{m.model}</td>
                      <td className={styles.count}>{m.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </section>
    </main>
  );
}
