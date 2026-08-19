'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { getSalesTimeline, SaleDay } from '@/services/stats.service';
import { formatDate } from '@/lib/date';
import styles from './SalesChart.module.css';

const PERIODS = [7, 15, 30] as const;
type Period = typeof PERIODS[number];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export default function SalesChart({ className }: { className?: string }) {
  const [period, setPeriod] = useState<Period>(7);
  const [data, setData] = useState<SaleDay[]>([]);

  useEffect(() => {
    getSalesTimeline(period).then(setData).catch(() => setData([]));
  }, [period]);

  const total = data.reduce((sum, d) => sum + d.total, 0);
  const chartData = data.map(d => ({ ...d, date: formatDateShort(d.date), fullDate: formatDate(d.date) }));

  return (
    <Card className={`${styles.card}${className ? ` ${className}` : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Ventas</span>
        <div className={styles.periodToggle}>
          {PERIODS.map(p => (
            <button
              key={p}
              className={`${styles.periodBtn}${period === p ? ` ${styles.active}` : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>
      <span className={styles.total}>{formatCurrency(total)}</span>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis hide />
          <Tooltip formatter={(value, _name, props) => [formatCurrency(Number(value)), props.payload?.fullDate ?? '']} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#salesGradient)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
