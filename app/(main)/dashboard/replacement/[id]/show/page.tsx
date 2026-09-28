'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BackPage from '@/components/shared/BackPage';
import ProductImage from '@/components/shared/ProductImage';
import Dropdown from '@/components/ui/Dropdown';
import Confirm from '@/components/shared/Confirm';
import { deleteReplacement, getReplacement, Replacement } from '@/services/replacement.service';
import PartMapWrapper from '@/components/features/replacements/PartMapWrapper';
import { usePermissions } from '@/hooks/usePermissions';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReplacementShowPage({ params }: PageProps) {
  const router = useRouter();
  const { canManage } = usePermissions();
  const [id, setId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setId(id);
      getReplacement(id)
        .then(setReplacement)
        .catch(() => setError('No se pudo cargar el producto'))
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function handleDelete() {
    if (!id) return false;
    await deleteReplacement(id);
  }

  if (loading) return <main className={styles.page}><p className={styles.hint}>Cargando...</p></main>;
  if (error || !replacement) return <main className={styles.page}><p className={styles.error}>{error ?? 'Producto no encontrado'}</p></main>;

  const info = replacement.globalReplacement;
  const hasLocation = replacement.latitude != null && replacement.longitude != null;

  return (
    <main className={styles.page}>
      <BackPage href="/dashboard/replacement" />

      <div className={styles.card}>
        {canManage && (
          <div className={styles.cardActions}>
            <Dropdown items={[
              { label: 'Eliminar', onClick: () => setConfirmingDelete(true), variant: 'danger', icon: '/icons/trash.svg' },
            ]} />
          </div>
        )}

        <div className={styles.imageWrapper}>
          <ProductImage src={info.imageUrl} alt={info.name} width={200} height={200} className={styles.image} showLabel />
        </div>

        <div className={styles.details}>
          <h1 className={styles.name}>{info.name}</h1>
          <p className={styles.brand}>{info.brand?.name}</p>

          <div className={styles.meta}>
            {info.productType && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Tipo</span>
                <span className={styles.metaValue}>{info.productType.name}</span>
              </div>
            )}
            {info.sku && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>SKU</span>
                <span className={styles.metaValue}>{info.sku}</span>
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

      <Confirm
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        onSuccess={() => router.push('/dashboard/replacement')}
        title="Eliminar producto"
        message={`¿Eliminar «${info.name}»?`}
        confirmLabel="Eliminar"
        loadingLabel="Eliminando…"
        confirmColor="danger"
        successMessage="El producto se eliminó correctamente."
      />
    </main>
  );
}
