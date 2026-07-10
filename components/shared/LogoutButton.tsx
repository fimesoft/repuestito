'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/services/auth.service';
import styles from './Header.module.css';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/app');
  }

  return (
    <button className={styles.logoutBtn} onClick={handleLogout}>
      Cerrar sesión
    </button>
  );
}
