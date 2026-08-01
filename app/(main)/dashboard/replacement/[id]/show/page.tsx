'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button/Button';
import { getReplacement, Replacement } from '@/services/replacement.service';
import PartMapWrapper from '@/components/features/replacements/PartMapWrapper';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReplacementShowPage({ params }: PageProps) {
  const router = useRouter();
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      getReplacement(id)
        .then(setReplacement)
        .catch(() => setError('No se pudo cargar el repuesto'))
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) return <main className={styles.page}><p className={styles.hint}>Cargando...</p></main>;
  if (error || !replacement) return <main className={styles.page}><p className={styles.error}>{error ?? 'Repuesto no encontrado'}</p></main>;

  const info = replacement.globalReplacement;
  const hasLocation = replacement.latitude != null && replacement.longitude != null;

  return (
    <main className={styles.page}>
      <Button label="← Volver" variant="ghost" color="neutral" onClick={() => router.back()} />

      <div className={styles.card}>
        {info.imageUrl && (
          <div className={styles.imageWrapper}>
            <Image src={info.imageUrl} alt={info.name} width={200} height={200} className={styles.image} />
          </div>
        )}

        <div className={styles.details}>
          <h1 className={styles.name}>{info.name}</h1>
          <p className={styles.brand}>{info.brand?.name}</p>

          <div className={styles.meta}>
            {info.codeOem && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Código OEM</span>
                <span className={styles.metaValue}>{info.codeOem}</span>
              </div>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Precio</span>
              <span className={styles.metaValue}>${Number(replacement.price).toFixed(2)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Stock</span>
              <span className={`${styles.metaValue} ${replacement.stock > 0 ? styles.inStock : styles.outStock}`}>
                {replacement.stock > 0 ? `${replacement.stock} unidades` : 'Agotado'}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>País</span>
              <span className={styles.metaValue}>{info.countryCode}</span>
            </div>
          </div>
        </div>
      </div>

      {hasLocation && (
        <div className={styles.mapSection}>
          <h2 className={styles.mapTitle}>Ubicación del local</h2>
          <PartMapWrapper
            storeLat={replacement.latitude!}
            storeLng={replacement.longitude!}
            storeName={info.name}
          />
        </div>
      )}
    </main>
  );
}
