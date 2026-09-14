'use client';

import { ChangeEvent } from 'react';
import styles from './Input.module.css';

interface InputProps {
  label?: string;
  name?: string;
  type?: 'text' | 'number' | 'email' | 'password';
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function Input({ label, error, ...rest }: InputProps) {
  return (
    <label className={styles.label}>
      {label && <span>{label}</span>}
      <input className={styles.input} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}
