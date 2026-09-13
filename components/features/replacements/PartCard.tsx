"use client";

import Image from "next/image";
import Link from "next/link";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import styles from "./PartCard.module.css";

interface PartCardProps {
  id: string;
  image: string | null;
  brand: string;
  name: string;
  price: number;
  active?: boolean;
  priority?: boolean;
  onAddToCart?: () => void;
}

export default function PartCard({ id, image, brand, name, price, active = true, priority, onAddToCart }: PartCardProps) {
  return (
    <div className={styles.card}>
      <Link href={`/parts/${id}`} className={styles.cardLink}>
        <div className={styles.imageWrapper}>
          {image ? (
            <Image src={image} alt={name} fill sizes="100%" className={styles.image} priority={priority} />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.metaRow}>
            <span className={styles.brand}>{brand}</span>
            <Badge label={active ? "Activo" : "Inactivo"} variant={active ? "active" : "inactive"} />
          </div>
          <h3 className={styles.name}>{name}</h3>
          <p className={styles.price}>${price}</p>
        </div>
      </Link>
      <div className={styles.cardFooter}>
        <Button
          label="Agregar Pedido"
          onClick={onAddToCart}
          variant="solid"
          color="neutral"
          shadow
          fullWidth
          disabled={!active}
        />
      </div>
    </div>
  );
}
