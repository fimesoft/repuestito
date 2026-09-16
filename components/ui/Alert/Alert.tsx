'use client';

import { useEffect, useState } from 'react';
import styles from './Alert.module.css';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';
export type AlertPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface AlertProps {
  variant: AlertVariant;
  message: string;
  duration?: number;
  position?: AlertPosition;
}

const ICONS: Record<AlertVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export default function Alert({ variant, message, duration, position }: AlertProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [message]);

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.alert} ${styles[variant]} ${position ? styles[position] : ''}`}
      role="alert"
    >
      <span className={styles.icon}>{ICONS[variant]}</span>
      <span className={styles.message}>{message}</span>
      <button className={styles.close} onClick={() => setVisible(false)} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
