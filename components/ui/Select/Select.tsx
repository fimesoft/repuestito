'use client';

import styles from './Select.module.css';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  width?: string | number;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  width,
}: SelectProps) {
  return (
    <select
      className={styles.select}
      style={width !== undefined ? { width } : undefined}
      value={String(value)}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      required={required}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
      ))}
    </select>
  );
}
