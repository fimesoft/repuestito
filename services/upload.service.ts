export interface UploadedImage {
  url: string;
  publicId: string;
}

/** Sube una imagen a Cloudinary vía el backend (solo GOD y MODERATOR). */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) throw new Error('Error al subir la imagen');
  return res.json() as Promise<UploadedImage>;
}
