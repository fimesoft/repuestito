'use client';

import { ReactNode, useId, useState } from 'react';
import Search from '@/components/ui/Search';
import Select, { SelectOption } from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import styles from './Filters.module.css';

interface SearchFilter {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface DateRangeFilter {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
}

interface SelectFilter {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

interface FiltersProps {
  search?: SearchFilter;
  dateRange?: DateRangeFilter;
  selects?: SelectFilter[];
  children?: ReactNode;
}

export default function Filters({ search, dateRange, selects, children }: FiltersProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={styles.filters}>
      <div className={styles.searchRow}>
        {search && <Search value={search.value} onChange={search.onChange} placeholder={search.placeholder} />}
        <button
          type="button"
          className={`${styles.toggle}${open ? ` ${styles.toggleOpen}` : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Ocultar filtros' : 'Mostrar filtros'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <div id={panelId} className={`${styles.panel}${open ? ` ${styles.panelOpen}` : ''}`}>
        {dateRange && (
          <>
            <Label text={dateRange.fromLabel ?? 'Desde'}>
              <input type="date" className={`${styles.input}${dateRange.from ? '' : ` ${styles.empty}`}`} value={dateRange.from} max={dateRange.to || undefined} onChange={e => dateRange.onFromChange(e.target.value)} />
            </Label>
            <Label text={dateRange.toLabel ?? 'Hasta'}>
              <input type="date" className={`${styles.input}${dateRange.to ? '' : ` ${styles.empty}`}`} value={dateRange.to} min={dateRange.from || undefined} onChange={e => dateRange.onToChange(e.target.value)} />
            </Label>
          </>
        )}
        {selects?.map(select => (
          <Label key={select.label} text={select.label}>
            <Select value={select.value} onChange={select.onChange} options={select.options} placeholder={select.placeholder} />
          </Label>
        ))}
        {children && <div className={styles.right}>{children}</div>}
      </div>
    </div>
  );
}
