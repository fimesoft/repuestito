'use client';

import styles from './EmptyState.module.css';

type Variant = 'empty' | 'not-found' | 'error' | 'no-results';

interface EmptyStateProps {
  variant: Variant;
  title?: string;
  description?: string;
}

const ICONS: Record<Variant, React.ReactNode> = {
  empty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 7l2 12h14L21 7M3 7l3-4h12l3 4" />
      <path d="M9 12h6" />
    </svg>
  ),
  'not-found': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M9 9l4 4M13 9l-4 4" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'no-results': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6" />
    </svg>
  ),
};

const DEFAULTS: Record<Variant, { title: string; description: string }> = {
  empty: {
    title: 'Sin datos aún',
    description: 'No hay registros cargados. Podés crear el primero.',
  },
  'not-found': {
    title: 'No encontrado',
    description: 'El recurso que buscás no existe o fue eliminado.',
  },
  error: {
    title: 'Algo salió mal',
    description: 'Ocurrió un error inesperado. Intentá de nuevo.',
  },
  'no-results': {
    title: 'Sin resultados',
    description: 'No hay coincidencias para tu búsqueda. Probá con otros términos o filtros.',
  },
};

const ICON_COLOR: Record<Variant, string> = {
  empty:       styles.iconPrimary,
  'not-found': styles.iconNeutral,
  error:       styles.iconError,
  'no-results': styles.iconNeutral,
};

export default function EmptyState({ variant, title, description }: EmptyStateProps) {
  const defaults = DEFAULTS[variant];

  return (
    <div className={styles.wrapper}>
      <span className={`${styles.icon} ${ICON_COLOR[variant]}`}>
        {ICONS[variant]}
      </span>
      <p className={styles.title}>{title ?? defaults.title}</p>
      <p className={styles.description}>{description ?? defaults.description}</p>
    </div>
  );
}
