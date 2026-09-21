'use client';

import styles from './VisibilityToggle.module.css';

interface VisibilityToggleProps {
  visible: boolean;
  onToggle: () => void;
  /** Qué se muestra u oculta, para el texto accesible ("capital invertido"). */
  label: string;
  className?: string;
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Botón de ojo para mostrar u ocultar un dato sensible (por ejemplo, un importe). */
export default function VisibilityToggle({ visible, onToggle, label, className }: VisibilityToggleProps) {
  const action = `${visible ? 'Ocultar' : 'Mostrar'} ${label}`;
  return (
    <button
      type="button"
      className={`${styles.button}${className ? ` ${className}` : ''}`}
      onClick={onToggle}
      aria-pressed={!visible}
      aria-label={action}
      title={action}
    >
      {visible ? <EyeIcon /> : <EyeOffIcon />}
    </button>
  );
}
