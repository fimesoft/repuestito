'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './ProductImage.module.css';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  title?: string;
  /** Sin width/height la imagen llena a su contenedor (que debe tener `position: relative`). */
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
  /** Muestra el texto "Imagen no disponible" bajo el ícono (para tamaños grandes). */
  showLabel?: boolean;
}

/** Imagen de producto con respaldo "Imagen no disponible" cuando no hay URL o la URL falla al cargar. */
export default function ProductImage({ src, alt, title, width, height, sizes = '100%', className, priority, showLabel }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fixed = width !== undefined && height !== undefined;

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label="Imagen no disponible"
        title={title}
        className={[styles.placeholder, fixed ? '' : styles.fill, className ?? ''].filter(Boolean).join(' ')}
        style={fixed ? { width, height } : undefined}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 16-5-5L8 19" />
        </svg>
        {showLabel && <span>Imagen no disponible</span>}
      </div>
    );
  }

  return fixed ? (
    <Image src={src} alt={alt} title={title} width={width} height={height} className={className} loading={priority ? 'eager' : undefined} onError={() => setFailedSrc(src)} />
  ) : (
    <Image src={src} alt={alt} title={title} fill sizes={sizes} className={className} loading={priority ? 'eager' : undefined} onError={() => setFailedSrc(src)} />
  );
}
