'use client';

import styles from './EmptyState.module.css';

type Variant = 'empty' | 'error' | 'no-results';
type EmptyIllustration = 'catalog' | 'orders';

interface EmptyStateProps {
  variant: Variant;
  title?: string;
  description?: string;
  illustration?: EmptyIllustration;
}

const EMPTY_ILLUSTRATIONS: Record<EmptyIllustration, string> = {
  catalog: '/icons/logo-empty.svg',
  orders: '/icons/logo-empty-orders.svg',
};

const NO_RESULTS_ILLUSTRATION = '/icons/logo-empty-no-results.svg';
const ERROR_ILLUSTRATION = '/icons/logo-empty-error.svg';

const DEFAULTS: Record<Variant, { title: string; description: string }> = {
  empty: {
    title: 'Sin datos aún',
    description: 'No hay registros cargados. Podés crear el primero.',
  },
  error: {
    title: 'Algo salió mal',
    description: 'Algo falló de nuestro lado. Prueba de nuevo en un momento o contacta con soporte si sigue ocurriendo.',
  },
  'no-results': {
    title: 'Sin resultados',
    description: 'No hay coincidencias para tu búsqueda. Probá con otros términos o filtros.',
  },
};

export default function EmptyState({ variant, title, description, illustration = 'catalog' }: EmptyStateProps) {
  const defaults = DEFAULTS[variant];

  return (
    <div className={styles.wrapper}>
      <span className={styles.icon}>
        {variant === 'empty' && <img src={EMPTY_ILLUSTRATIONS[illustration]} width={140} height={117} alt="" />}
        {variant === 'no-results' && <img src={NO_RESULTS_ILLUSTRATION} width={140} height={117} alt="" />}
        {variant === 'error' && <img src={ERROR_ILLUSTRATION} width={140} height={117} alt="" />}
      </span>
      <p className={styles.title}>{title ?? defaults.title}</p>
      <p className={styles.description}>{description ?? defaults.description}</p>
    </div>
  );
}
