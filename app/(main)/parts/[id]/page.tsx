import Image from 'next/image';
import Link from 'next/link';
import { getReplacement } from '@/services/replacement.service';
import { getCompatibilityByReplacement } from '@/services/compatibility.service';
import PartMapWrapper from '@/components/features/replacements/PartMapWrapper';
import DistanceBadge from '@/components/features/replacements/DistanceBadge';
import { COMPATIBILITY_COUNTRIES, CompatibilityCountry } from '@/lib/compatibility-countries';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PartDetailPage({ params }: PageProps) {
  const { id } = await params;
  const part = await getReplacement(id, { next: { revalidate: 60 } } as RequestInit);

  const compatCountry = COMPATIBILITY_COUNTRIES.includes(part.country as CompatibilityCountry)
    ? (part.country as CompatibilityCountry)
    : null;
  const compatibility = compatCountry
    ? await getCompatibilityByReplacement(compatCountry, id)
    : [];

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.back}>← Volver</Link>

      <div className={styles.detail}>
        <div className={styles.imageWrapper}>
          {part.imageUrl ? (
            <Image src={part.imageUrl} alt={part.name} fill sizes="100%" className={styles.image} priority />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
        </div>

        <div className={styles.info}>
          <span className={styles.brand}>{part.brand}</span>
          <h1 className={styles.name}>{part.name}</h1>
          <p className={styles.price}>${part.price.toLocaleString()}</p>

          <dl className={styles.meta}>
            {part.codeOem && (
              <>
                <dt>Código OEM</dt>
                <dd>{part.codeOem}</dd>
              </>
            )}
            <dt>Stock</dt>
            <dd>{part.stock} unidades</dd>
            <dt>País</dt>
            <dd>{part.country}</dd>
            <dt>Distancia</dt>
            {part.latitude != null && part.longitude != null && (
              <DistanceBadge storeLat={part.latitude} storeLng={part.longitude} />
            )}
          </dl>
        </div>
      </div>

      {compatibility.length > 0 && (
        <section className={styles.compatSection}>
          <h2 className={styles.compatTitle}>Compatible con</h2>
          <ul className={styles.compatList}>
            {compatibility.map(entry => (
              <li key={entry.id} className={styles.compatItem}>
                <span className={styles.compatBrand}>{entry.vehicleModel.brand}</span>
                {' '}{entry.vehicleModel.model}
                <span className={styles.compatYears}>
                  {entry.vehicleModel.yearFrom}–{entry.vehicleModel.yearTo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {compatCountry && compatibility.length === 0 && (
        <section className={styles.compatSection}>
          <h2 className={styles.compatTitle}>Compatible con</h2>
          <p className={styles.compatEmpty}>Sin datos de compatibilidad para este país.</p>
        </section>
      )}

      <section className={styles.mapSection}>
        <h2 className={styles.mapTitle}>Punto de venta</h2>
        {part.latitude != null && part.longitude != null && (
          <PartMapWrapper
            storeLat={part.latitude}
            storeLng={part.longitude}
            storeName={part.name}
          />
        )}
      </section>
    </main>
  );
}
