"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import FileDropzone from "@/components/shared/FileDropzone";
import Button from "@/components/ui/Button/Button";
import { compressImage } from "@/lib/image";
import styles from "./ImageUpload.module.css";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface ImageUploadProps {
  /**
   * Entrega el archivo ya comprimido (o null al quitarlo). No sube nada: la subida la hace
   * quien guarda el formulario, para no dejar imágenes huérfanas si el usuario cancela.
   */
  onChange: (file: File | null) => void;
  initialUrl?: string;
}

export default function ImageUpload({ onChange, initialUrl }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [processing, setProcessing] = useState(false);
  const [picked, setPicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrl = useRef<string | null>(null);

  function revokePreview() {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
  }

  useEffect(() => revokePreview, []);

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("La imagen no puede superar 5 MB");
      return;
    }

    setProcessing(true);

    try {
      const compressed = await compressImage(file);
      revokePreview();
      blobUrl.current = URL.createObjectURL(compressed);
      setPreview(blobUrl.current);
      setPicked(true);
      onChange(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      revokePreview();
      setPreview(initialUrl ?? null);
      setPicked(false);
      onChange(null);
    } finally {
      setProcessing(false);
    }
  }

  // Descarta el archivo elegido: vuelve a la imagen inicial (si la hay) o queda vacío
  function handleRemove() {
    revokePreview();
    setPreview(initialUrl ?? null);
    setPicked(false);
    setError(null);
    onChange(null);
  }

  return (
    <>
    <FileDropzone onFileSelect={handleFile} accept="image/*">
      {preview ? (
        <div className={styles.preview}>
          <Image
            src={preview}
            alt="preview"
            fill
            sizes="100%"
            className={styles.previewImg}
            unoptimized={preview.startsWith('blob:')}
          />
          {processing && <div className={styles.overlay}>Procesando...</div>}
        </div>
      ) : (
        <div className={styles.placeholder}>
          <span className={styles.icon}>↑</span>
          <p>{processing ? "Procesando..." : "Arrastra una imagen o haz clic"}</p>
          <span className={styles.hint}>JPG, PNG, WEBP · Máx. 5 MB</span>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </FileDropzone>
    {picked && <Button label={initialUrl ? "Descartar nueva imagen" : "Quitar imagen"} variant="ghost" color="neutral" size="sm" onClick={handleRemove} />}
    </>
  );
}
