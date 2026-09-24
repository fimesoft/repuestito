'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { getSalesTimeline, SaleDay } from '@/services/stats.service';
import { formatDate } from '@/lib/date';
import { convertLocalToUsd, formatMoney } from '@/lib/currency';
import styles from './SalesChart.module.css';

const PERIODS = [7, 15, 30] as const;
type Period = typeof PERIODS[number];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

interface SalesChartProps {
  className?: string;
  currencyCode: string;
  exchangeRate?: number;
}

export default function SalesChart({ className, currencyCode, exchangeRate }: SalesChartProps) {
  const [period, setPeriod] = useState<Period>(7);
  const [data, setData] = useState<SaleDay[]>([]);

  useEffect(() => {
    getSalesTimeline(period).then(setData).catch(() => setData([]));
  }, [period]);

  const displayValue = (value: number) => exchangeRate ? convertLocalToUsd(value, exchangeRate) : value;
  const chartData = data.map(d => ({ ...d, total: displayValue(d.total), date: formatDateShort(d.date), fullDate: formatDate(d.date) }));
  const total = chartData.reduce((sum, d) => sum + d.total, 0);

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
      <span className={styles.total}>{formatMoney(total, currencyCode)}</span>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide />
            <Tooltip formatter={(value, _name, props) => [formatMoney(Number(value), currencyCode), props.payload?.fullDate ?? '']} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#salesGradient)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
