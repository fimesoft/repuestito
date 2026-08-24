import { Suspense } from 'react';
import { cookies } from 'next/headers';
import CountrySelect from '../CountrySelect';
import Avatar from '@/components/ui/Avatar';
import { getMe } from '@/services/auth.service';
import { hasRole } from '@/lib/roles';
import styles from './Header.module.css';

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value ?? '';
  const user = await getMe(`token=${token}`);
  const isAdmin = hasRole(user?.role, 'ADMIN');

  return (
    <header className={styles.header}>
      <Suspense fallback={null}>
        <div className={styles.rightSlot}>
          {isAdmin && <CountrySelect />}
          {user && <Avatar name={user.email} />}
        </div>
      </Suspense>
    </header>
  );
}
