import styles from './Logo.module.css';

interface LogoProps {
  href?: string;
}

export default function Logo({ href = '/' }: LogoProps) {
  return (
    <a href={href} className={styles.logo}>
      <span className={styles.icon}>
        <span className={styles.inner} />
      </span>
      <span className={styles.text}>Repuestito</span>
    </a>
  );
}
