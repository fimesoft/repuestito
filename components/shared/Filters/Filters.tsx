'use client';

import { ReactNode } from 'react';
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
  return (
    <div className={styles.filters}>
      {search && <Search value={search.value} onChange={search.onChange} placeholder={search.placeholder} />}
      {dateRange && (
        <>
          <Label text={dateRange.fromLabel ?? 'Desde'}>
            <input type="date" className={styles.input} value={dateRange.from} max={dateRange.to || undefined} onChange={e => dateRange.onFromChange(e.target.value)} />
          </Label>
          <Label text={dateRange.toLabel ?? 'Hasta'}>
            <input type="date" className={styles.input} value={dateRange.to} min={dateRange.from || undefined} onChange={e => dateRange.onToChange(e.target.value)} />
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
  );
}
