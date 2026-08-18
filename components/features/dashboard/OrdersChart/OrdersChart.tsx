'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import styles from './OrdersChart.module.css';

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  fulfilled: number;
  cancelled: number;
}

const SLICES = [
  { name: 'Pendientes',  key: 'pending',   color: '#f59e0b' },
  { name: 'Confirmados', key: 'confirmed',  color: '#3b82f6' },
  { name: 'Facturados',  key: 'fulfilled',  color: '#10b981' },
  { name: 'Cancelados',  key: 'cancelled',  color: '#ef4444' },
] as const;

export default function OrdersChart({ orders }: { orders: OrderStats }) {
  const data = SLICES
    .map(s => ({ name: s.name, value: orders[s.key], color: s.color }))
    .filter(d => d.value > 0);

  return (
    <Card className={styles.card}>
      <span className={styles.title}>Distribución de pedidos por estado</span>
      {orders.total === 0 ? (
        <p className={styles.empty}>Sin pedidos registrados aún</p>
      ) : (
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={false} labelLine={false}>
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [value, `Pedidos ${String(name).toLowerCase()}`]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className={styles.legend}>
            {SLICES.map(s => (
              <li key={s.key} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: s.color }} />
                <span className={styles.legendLabel}>{s.name}</span>
                <span className={styles.legendValue}>{orders[s.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
