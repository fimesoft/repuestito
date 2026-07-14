import { Suspense } from 'react';
import { cookies } from 'next/headers';
import Search from './Search';
import CountrySelect from './CountrySelect';
import UserBadge from './UserBadge';
import { getMe } from '@/services/auth.service';
import styles from './Header.module.css';

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value ?? '';
  const user = await getMe(`token=${token}`);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className={styles.header}>
      <Suspense fallback={null}>
        <Search />
        <div className={styles.rightSlot}>
          <UserBadge />
          {isAdmin && <CountrySelect />}
        </div>
      </Suspense>
    </header>
  );
}
