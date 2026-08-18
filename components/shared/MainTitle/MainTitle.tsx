import styles from './MainTitle.module.css';

interface MainTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export default function MainTitle({ title, subtitle, className }: MainTitleProps) {
  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
