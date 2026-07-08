'use client';

import { useSearchParams } from 'next/navigation';
import Button from '../ui/Button/Button';
import styles from './Search.module.css';

export default function Search() {
  const searchParams = useSearchParams();
  const country = searchParams.get('country');

  return (
    <form className={styles.form} method="GET" action="/">
      {country && <input type="hidden" name="country" value={country} />}
      <input
        className={styles.input}
        name="search"
        defaultValue={searchParams.get('search') ?? ''}
        placeholder="Buscar por nombre..."
        autoComplete="off"
      />
      <Button label="Buscar" type="submit" variant="solid" color="primary" />
    </form>
  );
}
