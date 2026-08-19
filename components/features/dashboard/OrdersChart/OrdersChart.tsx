'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts';
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
  { name: 'Pendientes',  key: 'pending',   color: '#d48e00'  },
  { name: 'Confirmados', key: 'confirmed',  color: '#009294' },
  { name: 'Facturados',  key: 'fulfilled',  color: 'var(--color-primary)' },
  { name: 'Cancelados',  key: 'cancelled',  color: '#a95cbb' },
] as const;

export default function OrdersChart({ orders, className }: { orders: OrderStats; className?: string }) {

  const data = SLICES
    .map(s => ({ name: s.name, value: orders[s.key], color: s.color }))
    .filter(d => d.value > 0);

  return (
    <Card className={`${styles.card}${className ? ` ${className}` : ''}`}>
      <span className={styles.title}>Distribución de pedidos por estado</span>
      {orders.total === 0 ? (
        <p className={styles.empty}>Sin pedidos registrados aún</p>
      ) : (
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} cx="40%" cy="40%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={false} labelLine={false}>
                <Label content={({ viewBox }) => {
                  const { cx, cy } = viewBox as { cx: number; cy: number };
                  return (
                    <g>
                      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '1.2rem', fontWeight: 700, fill: 'var(--color-text)' }}>
                        {orders.total}
                      </text>
                      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '11px', fill: 'var(--color-text-muted)' }}>
                        totales
                      </text>
                    </g>
                  );
                }} />
                {data.map((entry, i) => <Cell key={i} style={{ fill: entry.color }} />)}
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
