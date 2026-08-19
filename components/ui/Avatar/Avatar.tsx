import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string): string {
  const trimmed = name.trim();

  // Email
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0];
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  // Full name or single word
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0][0].toUpperCase();
}

export default function Avatar({ name, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      className={[styles.avatar, styles[size], className].filter(Boolean).join(' ')}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
