import AuthBlock from '@/components/features/auth/AuthBlock';
import styles from './page.module.css';

export const metadata = { title: 'Ingresar — Repuestito' };

interface PageProps {
  searchParams: Promise<{ view?: string; email?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { view, email } = await searchParams;
  return (
    <main className={styles.page}>
      <div className={styles.left}>
        <AuthBlock initialView={view} initialEmail={email} />
      </div>

      <div className={styles.right}>
        <div className={styles.tagline}>
          <h2>El marketplace de repuestos que necesitas</h2>
          <p>Encuentra piezas originales y alternativas para tu vehículo.</p>
        </div>
      </div>
    </main>
  );
}
