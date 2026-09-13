'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuPosition, setMenuPosition] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function close() { setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }

    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = items.length * 38 + 8;
      setMenuPosition(rect.bottom + 4 + estimatedHeight > window.innerHeight
        ? { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 4 }
        : { right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    }
    setOpen(true);
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.trigger} onClick={toggleMenu} aria-label="Acciones" aria-haspopup="menu" aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="2.5" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13.5" r="1.5" />
        </svg>
      </button>

      {open && createPortal(
        <div className={styles.menu} ref={menuRef} role="menu" style={menuPosition}>
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
        </div>,
        document.body,
      )}
    </div>
  );
}
