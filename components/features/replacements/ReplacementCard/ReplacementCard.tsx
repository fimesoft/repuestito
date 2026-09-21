'use client';

import Link from 'next/link';
import ProductImage from '@/components/shared/ProductImage';
import { BADGE_ACCENT_VAR, BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Tooltip from '@/components/ui/Tooltip';
import type { StockLevel } from '@/constants/replacement';
import styles from './ReplacementCard.module.css';

const LEVEL_VARIANT: Record<StockLevel, BadgeVariant> = {
  low: 'stockLow',
  normal: 'stockNormal',
  full: 'stockFull',
};

interface ReplacementCardProps {
  href: string;
  image: string | null;
  brand: string;
  name: string;
  sku?: string | null;
  price: number;
  stock: number;
  stockLevel: StockLevel;
  stockHint: string;
  active?: boolean;
  priority?: boolean;
  onEdit?: () => void;
  onOrder?: () => void;
}

function formatPrice(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function ReplacementCard({
  href, image, brand, name, sku, price, stock, stockLevel, stockHint, active = true, priority, onEdit, onOrder,
}: ReplacementCardProps) {
  const accent = BADGE_ACCENT_VAR[LEVEL_VARIANT[stockLevel]];

  return (
    <article className={`${styles.card} ${active ? '' : styles.off}`}>
      <div className={styles.media}>
        <div className={styles.imageWrapper}>
          <ProductImage src={image} alt={name} className={styles.image} priority={priority} />
        </div>
        <div className={styles.actions}>
          <Button label="Agregar al pedido" icon="/icons/plus.svg" iconOnly variant="secondary" onClick={onOrder} disabled={!active} />
          {onEdit && <Button label="Editar" icon="/icons/edit.svg" iconOnly variant="secondary" onClick={onEdit} />}
        </div>
      </div>
      <Link href={href} className={styles.body}>
        <div className={styles.row}>
          <p className={styles.price}>{formatPrice(price)}</p>
          {active ? (
            <Tooltip content={stockHint} color={accent} position="bottom">
              <span className={styles.stock}>
                <span className={styles.dot} style={{ background: accent }} />
                {stock} u.
              </span>
            </Tooltip>
          ) : (
            <span className={styles.stock}>Inactivo</span>
          )}
        </div>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.meta}>{sku ? `${brand} · ${sku}` : brand}</p>
      </Link>
    </article>
  );
}
