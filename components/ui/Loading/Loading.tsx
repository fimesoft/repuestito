import styles from './Loading.module.css';

interface LoadingProps {
  text?: string;
}

export default function Loading({ text = 'Cargando...' }: LoadingProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.text}>{text}</span>
    </div>
  );
}
