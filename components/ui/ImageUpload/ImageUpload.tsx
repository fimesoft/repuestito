"use client";

import { useState } from "react";
import Image from "next/image";
import FileDropzone from "@/components/shared/FileDropzone";
import { compressImage } from "@/lib/image";
import styles from "./ImageUpload.module.css";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface ImageUploadProps {
  onUpload: (url: string) => void;
  initialUrl?: string;
}

export default function ImageUpload({ onUpload, initialUrl }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setUploading(true);

    try {
      const compressed = await compressImage(file);
      setPreview(URL.createObjectURL(compressed));

      const formData = new FormData();
      formData.append("file", compressed);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
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

  return (
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
    </FileDropzone>
  );
}
