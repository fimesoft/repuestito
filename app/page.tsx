import AuthBlock from '@/components/features/auth/AuthBlock';
import styles from './page.module.css';

export const metadata = { title: 'Ingresar - Piezify' };

interface PageProps {
  searchParams: Promise<{ view?: string; email?: string }>;
}

function MiniDashboard() {
  return (
    <div className={styles.miniApp}>
      <div className={styles.miniSidebar}>
        <span className={styles.miniMark} />
        <span /><span /><span /><span />
      </div>
      <div className={styles.miniContent}>
        <div className={styles.miniTopbar} />
        <div className={styles.miniTitle} />
        <div className={styles.miniCards}><span /><span /><span /></div>
        <div className={styles.miniChart}><i /><i /><i /><i /><i /><i /></div>
      </div>
    </div>
  );
}

function ProductShowcase() {
  return (
    <section className={styles.showcase} aria-label="Presentación de Piezify">
      <div className={styles.showcaseTop}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>GESTIONA TODOS TUS PRODUCTOS DE PUNTA A PUNTA.</p>
          <h1>Todo tu negocio en un solo lugar<span>.</span></h1>
        </div>
      </div>

      <div className={styles.devices} aria-hidden="true">
        <svg className={styles.wave} viewBox="0 0 1000 440" preserveAspectRatio="none">
          <path d="M0 80C240 182 502 181 1000 72V440H0Z" fill="currentColor" />
        </svg>
        <div className={styles.phone}>
          <div className={styles.phoneSpeaker} />
          <MiniDashboard />
        </div>
        <div className={styles.laptop}>
          <div className={styles.laptopScreen}><MiniDashboard /></div>
          <div className={styles.laptopBase}><span /></div>
        </div>
        <div className={styles.tablet}>
          <div className={styles.tabletCamera} />
          <MiniDashboard />
        </div>
      </div>
    </section>
  );
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { view, email } = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.authSide} aria-label="Acceso a Piezify">
        <div className={styles.authCard}>
          <AuthBlock initialView={view} initialEmail={email} />
        </div>
        <p className={styles.support}>¿Necesitás ayuda? <a href="mailto:soporte@piezify.com">soporte@piezify.com</a></p>
        <footer className={styles.footer}>(pzify-1.0.0) Copyright 2026©</footer>
      </section>
      <ProductShowcase />
    </main>
  );
}
