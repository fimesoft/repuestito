'use client';

import { Suspense } from 'react';
import Search from './Search';
import CountrySelect from './CountrySelect';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <Suspense>
        <Search />
        <CountrySelect />
      </Suspense>
    </header>
  );
}
