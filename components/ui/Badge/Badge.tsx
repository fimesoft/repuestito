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

export const BADGE_ACCENT_VAR: Record<BadgeVariant, string> = {
  active: 'var(--badge-active-text)',
  inactive: 'var(--badge-inactive-text)',
  neutral: 'var(--badge-neutral-text)',
  warning: 'var(--badge-warning-text)',
  info: 'var(--badge-info-text)',
  admin: 'var(--badge-admin-text)',
  moderator: 'var(--badge-moderator-text)',
  seller: 'var(--badge-seller-text)',
  stockLow: 'var(--badge-inactive-text)',
  stockNormal: 'var(--badge-warning-text)',
  stockFull: 'var(--badge-active-text)',
};

function toSentenceCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('es-AR');
  return normalized
    ? normalized.charAt(0).toLocaleUpperCase('es-AR') + normalized.slice(1)
    : normalized;
}

export default function Badge({ label, variant }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{toSentenceCase(label)}</span>;
}
