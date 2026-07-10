import { cookies } from 'next/headers';
import { getMe } from '@/services/auth.service';
import LogoutButton from './LogoutButton';
import styles from './Header.module.css';

export default async function UserBadge() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value ?? '';
  const user = await getMe(`token=${token}`);

  if (!user) return null;

  return (
    <div className={styles.userBadge}>
      <span className={styles.userEmail}>{user.email}</span>
      <span className={styles.userRole}>{user.role}</span>
      <LogoutButton />
    </div>
  );
}
