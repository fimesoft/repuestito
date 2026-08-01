'use client';

import styles from './Search.module.css';

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string | number;
}

export default function Search({ value, onChange, placeholder = 'Buscar...', width }: SearchProps) {
  return (
    <input
      className={styles.input}
      style={width !== undefined ? { width } : undefined}
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
