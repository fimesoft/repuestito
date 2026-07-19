import AuthBlock from '@/components/features/auth/AuthBlock';
import Logo from '@/components/shared/Logo';
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
        <div className={styles.leftInner}>
          <div className={styles.logoWrap}>
            <Logo href="/" />
          </div>
          <div className={styles.formWrap}>
            <AuthBlock initialView={view} initialEmail={email} />
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.tagline}>
          <h2>El marketplace de autopartes que conecta al mundo</h2>
          <p>Stock, pedidos y facturación de repuestos originales y alternativos, en un solo panel.</p>
        </div>
      </div>
    </main>
  );
}
