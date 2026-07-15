'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button/Button';
import ImageUpload from '@/components/ui/ImageUpload';
import { Replacement } from '@/services/replacement.service';
import styles from '@/styles/Create.module.css';

interface EditReplacementFormProps {
  replacement: Replacement;
}

export default function EditReplacementForm({ replacement }: EditReplacementFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: replacement.name,
    brand: replacement.brand,
    price: String(replacement.price),
    stock: String(replacement.stock),
    codeOem: replacement.codeOem ?? '',
    country: replacement.country,
    latitude: String(replacement.latitude),
    longitude: String(replacement.longitude),
  });
  const [imageUrl, setImageUrl] = useState<string | null>(replacement.imageUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name,
      brand: form.brand,
      price: Number(form.price),
      country: form.country,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      stock: Number(form.stock),
      ...(form.codeOem ? { codeOem: form.codeOem } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${replacement.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const data: unknown = await res.json();
        const message =
          data && typeof data === 'object' && 'message' in data
            ? String((data as { message: unknown }).message)
            : 'Error al actualizar el repuesto';
        throw new Error(message);
      }

      router.push(`/parts/${replacement.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.label}>
        Imagen del repuesto <span className={styles.optional}>(opcional)</span>
        <ImageUpload onUpload={setImageUrl} initialUrl={imageUrl ?? undefined} />
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Nombre
          <input className={styles.input} name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label className={styles.label}>
          Marca
          <input className={styles.input} name="brand" value={form.brand} onChange={handleChange} required />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Precio
          <input className={styles.input} name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required />
        </label>
        <label className={styles.label}>
          País (ISO 3166-1 alpha-2)
          <input className={styles.input} name="country" maxLength={2} placeholder="VE" value={form.country} onChange={handleChange} required />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Código OEM <span className={styles.optional}>(opcional)</span>
          <input className={styles.input} name="codeOem" value={form.codeOem} onChange={handleChange} placeholder="ej. 15400-PLM-A02" />
        </label>
        <label className={styles.label}>
          Stock
          <input className={styles.input} name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Latitud
          <input className={styles.input} name="latitude" type="number" step="any" value={form.latitude} onChange={handleChange} required />
        </label>
        <label className={styles.label}>
          Longitud
          <input className={styles.input} name="longitude" type="number" step="any" value={form.longitude} onChange={handleChange} required />
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button
          label={loading ? 'Guardando...' : 'Guardar cambios'}
          type="submit"
          variant="solid"
          color="primary"
          shadow
          disabled={loading}
        />
      </div>
    </form>
  );
}
