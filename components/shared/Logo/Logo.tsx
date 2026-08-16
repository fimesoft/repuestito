import styles from './Logo.module.css';

interface LogoProps {
  href?: string;
  className?: string;
}

export default function Logo({ href = '/', className }: LogoProps) {
  return (
    <a href={href} className={`${styles.logo}${className ? ` ${className}` : ''}`}>
      <span className={styles.icon}>
        <span className={styles.inner} />
      </span>
      <span className={styles.text}>Repuestito</span>
    </a>
  );
}
