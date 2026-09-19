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
  /** Si se pasa, agrega la opción final "Crear «texto»" (se oculta si ya hay una sugerencia con ese nombre exacto). */
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
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
  onCreate,
  createLabel,
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
  const query = value.trim();
  const canCreate =
    !!onCreate && query.length > 0 && !suggestions.some(item => getLabel(item).trim().toLowerCase() === query.toLowerCase());

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
          {canCreate && (
            <li
              className={styles.create}
              onMouseDown={() => {
                onCreate(query);
                setShowDropdown(false);
              }}
            >
              {createLabel ? createLabel(query) : `Crear «${query}»`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
