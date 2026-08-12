'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  title: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  size = 'md',
  title,
  onBack,
  children,
  footer,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={[styles.modal, styles[size]].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            {onBack && (
              <button className={styles.backBtn} onClick={onBack} aria-label="Volver">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <span className={styles.title}>{title}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
