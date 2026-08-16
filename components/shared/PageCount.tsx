'use client';

import { useRouter } from 'next/navigation';
import Select from '@/components/ui/Select';
import styles from './PageCount.module.css';

interface PageCountProps {
  total: number;
  limit: number;
  search?: string;
  country?: string;
  onLimitChange?: (limit: number) => void;
}

const LIMIT_OPTIONS = [10, 20, 50];

export default function PageCount({ total, limit, search, country, onLimitChange }: PageCountProps) {
  const router = useRouter();

  function handleChange(next: number) {
    if (onLimitChange) {
      onLimitChange(next);
      return;
    }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (country) params.set('country', country);
    params.set('limit', String(next));
    params.set('page', '1');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.total}>{total} registros totales</span>
      <Select
        value={limit}
        onChange={v => handleChange(Number(v))}
        options={LIMIT_OPTIONS.map(n => ({ value: n, label: `${n} por página` }))}
        width={140}
      />
    </div>
  );
}
