import { Suspense } from 'react';
import Search from './Search';
import CountrySelect from './CountrySelect';
import UserBadge from './UserBadge';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <Suspense fallback={null}>
        <Search />
        <div className={styles.rightSlot}>
          <UserBadge />
          <CountrySelect />
        </div>
      </Suspense>
    </header>
  );
}
