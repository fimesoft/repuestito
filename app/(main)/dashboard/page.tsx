import { cookies } from 'next/headers';
import { getMe } from '@/services/auth.service';

export const metadata = { title: 'Dashboard — Repuestito' };

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value ?? '';
  const user = await getMe(`token=${token}`);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      {JSON.stringify(user)}
      {user && <p>{user.email} · {user.role}</p>}
    </main>
  );
}
