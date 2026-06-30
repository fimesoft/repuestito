"use client";

import Image from "next/image";
import Link from "next/link";
import Button from "./Button";
import styles from "./PartCard.module.css";

interface PartCardProps {
  id: string;
  image: string | null;
  brand: string;
  name: string;
  price: number;
  priority?: boolean;
  onAddToCart?: () => void;
}

export default function PartCard({ id, image, brand, name, price, priority, onAddToCart }: PartCardProps) {
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
          <span className={styles.brand}>{brand}</span>
          <h3 className={styles.name}>{name}</h3>
          <p className={styles.price}>${price}</p>
        </div>
      </Link>
      <div className={styles.cardFooter}>
        <Button
          label="Agregar al carrito"
          onClick={onAddToCart}
          variant="solid"
          color="neutral"
          shadow
          fullWidth
        />
      </div>
    </div>
  );
}
