'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Button from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeContent: 'center',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--bg)',
            color: 'var(--color-text)',
          }}
        >
          <h1>No pudimos cargar esta pantalla</h1>
          <p>Intentá nuevamente. Si el problema continúa, ya quedó registrado.</p>
          <Button label="Reintentar" onClick={reset} />
        </main>
      </body>
    </html>
  );
}
