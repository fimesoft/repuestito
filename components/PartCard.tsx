"use client";

import Image from "next/image";
import Button from "./Button";
import styles from "./PartCard.module.css";

interface PartCardProps {
  image: string | null;
  brand: string;
  name: string;
  price: number;
  onAddToCart?: () => void;
}

export default function PartCard({ image, brand, name, price, onAddToCart }: PartCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        {image ? (
          <Image src={image} alt={name} fill sizes="100%" className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
      </div>
      <div className={styles.body}>
        <span className={styles.brand}>{brand}</span>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.price}>${price}</p>
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
