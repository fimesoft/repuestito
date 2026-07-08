import Image from 'next/image';
import AuthBlock from '@/components/features/auth/AuthBlock';
import styles from './page.module.css';

export const metadata = { title: 'Ingresar — Repuestito' };

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.left}>
        <AuthBlock />
      </div>

      <div className={styles.right}>
        <Image
          src="https://picsum.photos/seed/autoparts-garage/900/1200"
          alt="Repuestos automotrices"
          fill
          className={styles.image}
          priority
        />
        <div className={styles.tagline}>
          <h2>El marketplace de repuestos que necesitas</h2>
          <p>Encuentra piezas originales y alternativas para tu vehículo.</p>
        </div>
      </div>
    </main>
  );
}
