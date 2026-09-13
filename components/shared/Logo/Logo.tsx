import styles from './Logo.module.css';

interface LogoProps {
  href?: string;
  className?: string;
  iconOnly?: boolean;
}

export default function Logo({ href = '/', className, iconOnly = false }: LogoProps) {
  return (
    <a href={href} className={`${styles.logo}${className ? ` ${className}` : ''}`}>
      <svg className={styles.icon} viewBox="0 0 40 40" aria-hidden="true">
        <g className={styles.gear}>
          <path d="M11 3.5h18L38 20l-9 16.5H11L2 20l9-16.5Z" />
          <path className={styles.bevel} d="M13.5 8h13L33 20l-6.5 12h-13L7 20l6.5-12Z" />
          <circle cx="20" cy="20" r="5.25" />
        </g>
      </svg>
      {!iconOnly && <span className={styles.text}>Piezify</span>}
    </a>
  );
}
