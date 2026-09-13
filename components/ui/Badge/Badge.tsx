import styles from './Badge.module.css';

export type BadgeVariant =
  | 'active'
  | 'inactive'
  | 'neutral'
  | 'warning'
  | 'info'
  | 'admin'
  | 'moderator'
  | 'seller'
  | 'stockLow'
  | 'stockNormal'
  | 'stockFull';

export interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

function toSentenceCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('es-AR');
  return normalized
    ? normalized.charAt(0).toLocaleUpperCase('es-AR') + normalized.slice(1)
    : normalized;
}

export default function Badge({ label, variant }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{toSentenceCase(label)}</span>;
}
