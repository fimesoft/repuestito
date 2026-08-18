'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Dropdown.module.css';

export interface DropdownItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  icon?: string;
}

interface DropdownProps {
  items: DropdownItem[];
}

export default function Dropdown({ items }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(p => !p)} aria-label="Acciones">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="2.5" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13.5" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className={styles.menu}>
          {items.map((item, i) => (
            <button
              key={i}
              className={`${styles.item} ${item.variant === 'danger' ? styles.danger : ''}`}
              onClick={() => { item.onClick(); setOpen(false); }}
            >
              {item.icon && (
                <img src={item.icon} alt="" width={14} height={14} className={styles.icon} aria-hidden="true" />
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
