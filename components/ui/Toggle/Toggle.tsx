'use client';

import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div className={styles.row}>
      <div className={styles.labelGroup}>
        <span className={styles.title}>{label}</span>
        {description && <span className={styles.desc}>{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-active={String(checked)}
        className={styles.switch}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}
