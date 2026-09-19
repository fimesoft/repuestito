const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

// Redimensiona y recomprime a JPEG antes de subir — la mayoría de las fotos
// de celular llegan muy por encima de lo que se necesita para mostrar en la
// UI (Cloudinary ya sirve las imágenes optimizadas, pero el peso subido y
// guardado como original queda igual de pesado si no se procesa antes).
export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}
