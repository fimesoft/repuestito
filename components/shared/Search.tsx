'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import styles from './Search.module.css';

export default function Search() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const country = searchParams.get('country');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (value.length === 0 || value.length >= 3) {
      const params = new URLSearchParams();
      if (country) params.set('country', country);
      if (value) params.set('search', value);
      router.push(`/?${params.toString()}`);
    }
  }

  return (
    <>
      <input
        className={styles.input}
        name="search"
        defaultValue={searchParams.get('search') ?? ''}
        placeholder="Buscar por nombre, marca o código..."
        autoComplete="off"
        onChange={handleChange}
      />
    </>
  );
}
