import styles from './Badge.module.css';

export type BadgeVariant = 'active' | 'inactive' | 'neutral' | 'warning' | 'info' | 'admin' | 'moderator' | 'seller';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

export default function Badge({ label, variant }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{label}</span>;
}
