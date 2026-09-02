import styles from './Logo.module.css';

interface LogoProps {
  href?: string;
  className?: string;
  iconOnly?: boolean;
}

export default function Logo({ href = '/', className, iconOnly = false }: LogoProps) {
  return (
    <a href={href} className={`${styles.logo}${className ? ` ${className}` : ''}`}>
      <span className={styles.icon}>
        <span className={styles.inner} />
      </span>
      {!iconOnly && <span className={styles.text}>Piezify</span>}
    </a>
  );
}
