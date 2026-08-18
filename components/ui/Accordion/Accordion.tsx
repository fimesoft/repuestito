'use client';

import { useState } from 'react';
import styles from './Accordion.module.css';

interface AccordionProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function Accordion({ title, actions, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`${styles.wrapper} ${open ? styles.open : ''}`}>
      <div className={styles.header}>
        <div className={styles.trigger} onClick={() => setOpen(p => !p)}>
          {title}
          <img
            src={open ? '/icons/chevron-up.svg' : '/icons/chevron-down.svg'}
            width={16}
            height={16}
            alt=""
            className={styles.chevron}
          />
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {open && (
        <div className={styles.body}>
          {children}
        </div>
      )}
    </div>
  );
}
