import Link from 'next/link';
import styles from './BackPage.module.css';

interface BackPageProps {
  href: string;
  label?: string;
}

export default function BackPage({ href, label = 'Volver' }: BackPageProps) {
  return (
    <Link href={href} className={styles.link}>
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
