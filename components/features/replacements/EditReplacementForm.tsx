'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';
import { Replacement } from '@/services/replacement.service';
import styles from '@/styles/Create.module.css';

interface EditReplacementFormProps {
  replacement: Replacement;
}

export default function EditReplacementForm({ replacement }: EditReplacementFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    price: String(replacement.price),
    stock: String(replacement.stock),
    latitude: String(replacement.latitude ?? ''),
    longitude: String(replacement.longitude ?? ''),
  });
  const [active, setActive] = useState(replacement.active ?? true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleToggle(value: boolean) {
    if (!value) {
      setShowConfirm(true);
    } else {
      setActive(true);
    }
  }

  function confirmDeactivate() {
    setActive(false);
    setShowConfirm(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      price: Number(form.price),
      stock: Number(form.stock),
      active,
      ...(form.latitude ? { latitude: Number(form.latitude) } : {}),
      ...(form.longitude ? { longitude: Number(form.longitude) } : {}),
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${replacement.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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

  const gr = replacement.globalReplacement;

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.label}>
            Nombre
            <p className={styles.readOnly}>{gr?.name}</p>
          </div>
          <div className={styles.label}>
            Marca
            <p className={styles.readOnly}>{gr?.brand?.name}</p>
          </div>
        </div>

        {gr?.codeOem && (
          <div className={styles.label}>
            Código OEM
            <p className={styles.readOnly}>{gr.codeOem}</p>
          </div>
        )}

        <div className={styles.row}>
          <label className={styles.label}>
            Precio
            <input className={styles.input} name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required />
          </label>
          <label className={styles.label}>
            Stock
            <input className={styles.input} name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Latitud
            <input className={styles.input} name="latitude" type="number" step="any" value={form.latitude} onChange={handleChange} />
          </label>
          <label className={styles.label}>
            Longitud
            <input className={styles.input} name="longitude" type="number" step="any" value={form.longitude} onChange={handleChange} />
          </label>
        </div>

        <Toggle
          checked={active}
          onChange={handleToggle}
          label="Estado del repuesto"
          description={active ? 'Activo — visible en el marketplace' : 'Inactivo — no aparece en búsquedas'}
        />

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

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        size="sm"
        title="Desactivar repuesto"
        footer={
          <div className={styles.confirmActions}>
            <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setShowConfirm(false)} />
            <Button label="Desactivar" variant="solid" color="danger" onClick={confirmDeactivate} />
          </div>
        }
      >
        <p className={styles.confirmBody}>
          El repuesto <strong>{gr?.name}</strong> dejará de aparecer en el marketplace. Podés volver a activarlo en cualquier momento.
        </p>
      </Modal>
    </>
  );
}
