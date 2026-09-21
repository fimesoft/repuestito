'use client';

import { InputHTMLAttributes, ReactNode, useId } from 'react';
import styles from './FloatingInput.module.css';

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Texto que se muestra como placeholder y sube al enfocar o al tener valor. */
  label: string;
  /** Contenido a la derecha del campo (ej. botón de mostrar contraseña). */
  endAdornment?: ReactNode;
}

/**
 * Input con label flotante: el label ocupa el lugar del placeholder y sube al enfocar o escribir.
 * El `placeholder` que se pase queda como pista y solo se muestra con el label ya arriba.
 */
export default function FloatingInput({ label, endAdornment, placeholder, className, id, ...rest }: FloatingInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={`${styles.field} ${endAdornment ? styles.hasAdornment : ''} ${className ?? ''}`}>
      {/* `:placeholder-shown` exige un placeholder no vacío: sin pista se usa un espacio */}
      <input id={inputId} className={styles.input} placeholder={placeholder ?? ' '} {...rest} />
      <label htmlFor={inputId} className={styles.label}>{label}</label>
      {endAdornment && <div className={styles.adornment}>{endAdornment}</div>}
    </div>
  );
}
