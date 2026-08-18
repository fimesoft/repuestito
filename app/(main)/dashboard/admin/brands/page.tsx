'use client';

import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getBrands, createBrand, updateBrand, deleteBrand,
  Brand, CreateBrandPayload, UpdateBrandPayload,
} from '@/services/brands.service';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Badge from '@/components/ui/Badge';
import Dropdown from '@/components/ui/Dropdown';
import styles from './page.module.css';

export default function BrandsPage() {
  const { isAdmin } = usePermissions();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<CreateBrandPayload>({ name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrands().then(setBrands).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '' });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(b: Brand) {
    setEditing(b);
    setForm({ name: b.name, countryCode: b.countryCode ?? '', logoUrl: b.logoUrl ?? '', isVerified: b.isVerified, isActive: b.isActive });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const updated = await updateBrand(editing.id, form as UpdateBrandPayload);
        setBrands(prev => prev.map(b => b.id === updated.id ? updated : b));
      } else {
        const created = await createBrand(form);
        setBrands(prev => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta marca?')) return;
    try {
      await deleteBrand(id);
      setBrands(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const footer = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setModalOpen(false)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleSave} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Marcas</h1>
        {isAdmin && <Button label="+ Nueva marca" onClick={openCreate} shadow />}
      </div>

      {loading ? <Loading /> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Normalizado</th>
                <th>País</th>
                <th>Verificada</th>
                <th>Estado</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td><code>{b.normalizedName}</code></td>
                  <td>{b.countryCode ?? '—'}</td>
                  <td><Badge label={b.isVerified ? 'Sí' : 'No'} variant={b.isVerified ? 'active' : 'inactive'} /></td>
                  <td><Badge label={b.isActive ? 'Activo' : 'Inactivo'} variant={b.isActive ? 'active' : 'inactive'} /></td>
                  {isAdmin && (
                    <td>
                      <Dropdown items={[
                        { label: 'Editar', onClick: () => openEdit(b), icon: '/icons/edit.svg' },
                        { label: 'Eliminar', onClick: () => handleDelete(b.id), variant: 'danger', icon: '/icons/trash.svg' },
                      ]} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {brands.length === 0 && <p className={styles.empty}>No hay marcas registradas.</p>}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar marca' : 'Nueva marca'} size="md" footer={footer}>
        <div className={styles.form}>
          <label className={styles.label}>
            Nombre
            <input className={styles.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </label>
          <div className={styles.row}>
            <label className={styles.label}>
              Código de país
              <input className={styles.input} value={form.countryCode ?? ''} maxLength={2} onChange={e => setForm(p => ({ ...p, countryCode: e.target.value.toUpperCase() }))} />
            </label>
            <label className={styles.label}>
              URL logo
              <input className={styles.input} value={form.logoUrl ?? ''} onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))} />
            </label>
          </div>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.isVerified ?? false} onChange={e => setForm(p => ({ ...p, isVerified: e.target.checked }))} />
            Verificada
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
            Activa
          </label>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </Modal>
    </main>
  );
}
