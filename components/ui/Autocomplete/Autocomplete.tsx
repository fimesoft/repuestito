'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Autocomplete.module.css';

interface AutocompleteProps<T> {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onSelect: (item: T) => void;
  suggestions: T[];
  getLabel: (item: T) => string;
  getKey: (item: T) => string | number;
  placeholder?: string;
  emptyMessage?: string;
  minChars?: number;
  debounceMs?: number;
}

export default function Autocomplete<T>({
  value,
  onChange,
  onSearch,
  onSelect,
  suggestions,
  getLabel,
  getKey,
  placeholder,
  emptyMessage = 'No se encontraron resultados',
  minChars = 3,
  debounceMs = 400,
}: AutocompleteProps<T>) {
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length < minChars) return;
    const t = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(t);
  }, [value, minChars, debounceMs, onSearch]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    setShowDropdown(true);
  }

  function handleSelect(item: T) {
    onSelect(item);
    setShowDropdown(false);
  }

  const isOpen = showDropdown && value.length >= minChars;

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={handleChange}
        onFocus={() => value.length >= minChars && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && (
        <ul className={styles.dropdown}>
          {suggestions.length > 0 ? suggestions.map(item => (
            <li
              key={getKey(item)}
              className={styles.item}
              onMouseDown={() => handleSelect(item)}
            >
              {getLabel(item)}
            </li>
          )) : (
            <li className={styles.empty}>{emptyMessage}</li>
          )}
        </ul>
      )}
    </div>
  );
}
