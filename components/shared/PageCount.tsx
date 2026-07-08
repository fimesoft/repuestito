'use client';

import { useRouter } from 'next/navigation';
import styles from './PageCount.module.css';

interface PageCountProps {
  total: number;
  limit: number;
  search?: string;
  country?: string;
}

const LIMIT_OPTIONS = [10, 20, 50];

export default function PageCount({ total, limit, search, country }: PageCountProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (country) params.set('country', country);
    params.set('limit', e.target.value);
    params.set('page', '1');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.total}>{total} registros totales</span>
      <select className={styles.select} value={limit} onChange={handleChange}>
        {LIMIT_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} por página
          </option>
        ))}
      </select>
    </div>
  );
}
