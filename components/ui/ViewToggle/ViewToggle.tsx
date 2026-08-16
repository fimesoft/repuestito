'use client';

import Image from 'next/image';
import styles from './ViewToggle.module.css';

export type ViewMode = 'table' | 'grid';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className={styles.wrapper}>
      <button
        className={value === 'table' ? styles.btnActive : styles.btn}
        onClick={() => onChange('table')}
        aria-label="Vista tabla"
      >
        <Image src="/icons/view-table.svg" alt="Tabla" width={18} height={18} />
      </button>
      <button
        className={value === 'grid' ? styles.btnActive : styles.btn}
        onClick={() => onChange('grid')}
        aria-label="Vista tarjetas"
      >
        <Image src="/icons/view-cards.svg" alt="Tarjetas" width={18} height={18} />
      </button>
    </div>
  );
}
