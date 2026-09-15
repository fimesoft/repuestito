import { ReactNode } from 'react';
import styles from './Label.module.css';

interface LabelProps {
  text: ReactNode;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export default function Label({ text, size = 'md', children }: LabelProps) {
  return (
    <label className={`${styles.label} ${size === 'sm' ? styles.sm : ''}`}>
      <span>{text}</span>
      {children}
    </label>
  );
}
