import styles from './Loading.module.css';

interface LoadingProps {
  text?: string;
  variant?: 'spinner' | 'orbit';
}

export default function Loading({ text = 'Cargando...', variant = 'spinner' }: LoadingProps) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      {variant === 'orbit' ? (
        <span className={styles.orbit} aria-hidden="true">
          <span className={styles.orbitPiece} />
          <span className={styles.orbitPiece} />
          <span className={styles.orbitPiece} />
          <span className={styles.orbitPiece} />
          <span className={styles.orbitCore} />
        </span>
      ) : (
        <span className={styles.spinner} aria-hidden="true" />
      )}
      <span className={styles.text}>{text}</span>
    </div>
  );
}
