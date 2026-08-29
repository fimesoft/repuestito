'use client';

import { useRef, useState, DragEvent, ChangeEvent, ReactNode } from 'react';
import styles from './FileDropzone.module.css';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
  children: ReactNode;
}

export default function FileDropzone({ onFileSelect, accept, className, children }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  return (
    <div
      className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${className ?? ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.hidden}
        onChange={handleChange}
      />
      {children}
    </div>
  );
}
