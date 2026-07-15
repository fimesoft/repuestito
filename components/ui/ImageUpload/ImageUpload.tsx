"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import styles from "./ImageUpload.module.css";

interface ImageUploadProps {
  onUpload: (url: string) => void;
  initialUrl?: string;
}

export default function ImageUpload({ onUpload, initialUrl }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error al subir la imagen");

      const data = await res.json() as { url: string; publicId: string };
      onUpload(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hidden}
        onChange={handleChange}
      />

      {preview ? (
        <div className={styles.preview}>
          <Image src={preview} alt="preview" fill sizes="100%" className={styles.previewImg} />
          {uploading && <div className={styles.overlay}>Subiendo...</div>}
        </div>
      ) : (
        <div className={styles.placeholder}>
          <span className={styles.icon}>↑</span>
          <p>{uploading ? "Subiendo..." : "Arrastra una imagen o haz clic"}</p>
          <span className={styles.hint}>JPG, PNG, WEBP · Máx. 5 MB</span>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
