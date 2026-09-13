'use client';

import { useEffect, useState } from 'react';
import Select from '@/components/ui/Select';
import styles from './ThemeSelect.module.css';

type Theme = 'light' | 'dark';

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem('piezify-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function handleChange(value: string) {
    const nextTheme: Theme = value === 'dark' ? 'dark' : 'light';
    window.localStorage.setItem('piezify-theme', nextTheme);
    setTheme(nextTheme);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Tema</span>
      <Select
        value={theme}
        onChange={handleChange}
        ariaLabel="Seleccionar tema"
        width={110}
        options={[
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Oscuro' },
        ]}
      />
    </div>
  );
}
