'use client';

import styles from './ChipRail.module.css';

export interface ChipOption {
  value: string;
  label: string;
}

interface ChipRailProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function ChipRail({ options, value, onChange, ariaLabel }: ChipRailProps) {
  return (
    <div className={styles.rail} role="group" aria-label={ariaLabel}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={styles.chip}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
