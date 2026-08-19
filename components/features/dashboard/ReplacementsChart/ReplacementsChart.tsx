'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from '@/components/ui/Card';
import styles from './ReplacementsChart.module.css';

interface ReplacementStats {
  active: number;
  inactive: number;
  total: number;
}

const DATA_COLORS = { active: 'var(--color-primary)', inactive: '#a95cbb' };

export default function ReplacementsChart({ replacements, className }: { replacements: ReplacementStats; className?: string }) {
  const data = [
    { name: 'Activos',   value: replacements.active,   color: DATA_COLORS.active },
    { name: 'Inactivos', value: replacements.inactive, color: DATA_COLORS.inactive },
  ];

  return (
    <Card className={`${styles.card}${className ? ` ${className}` : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Repuestos por estado</span>
        <span className={styles.total}>{replacements.total} <span className={styles.totalLabel}>totales</span></span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="40%">
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={30} />
          <Tooltip formatter={(value, name) => [value, String(name)]} cursor={{ fill: 'var(--bg-subtle)' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} style={{ fill: entry.color }} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
