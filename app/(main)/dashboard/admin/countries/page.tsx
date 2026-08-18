'use client';

import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getCountries, createCountry, updateCountry, deleteCountry,
  Country, CreateCountryPayload, UpdateCountryPayload,
} from '@/services/country.service';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Badge from '@/components/ui/Badge';
import Dropdown from '@/components/ui/Dropdown';
import styles from './page.module.css';

export default function CountriesPage() {
  const { isAdmin } = usePermissions();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [form, setForm] = useState<CreateCountryPayload>({ name: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCountries().then(setCountries).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', code: '' });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(c: Country) {
    setEditing(c);
    setForm({ name: c.name, code: c.code, codeAlpha3: c.codeAlpha3 ?? '', currencyCode: c.currencyCode ?? '', phoneCode: c.phoneCode ?? '', active: c.active });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const updated = await updateCountry(editing.id, form as UpdateCountryPayload);
        setCountries(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        const created = await createCountry(form);
        setCountries(prev => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este país?')) return;
    try {
      await deleteCountry(id);
      setCountries(prev => prev.filter(c => c.id !== id));
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
        <h1 className={styles.title}>Países</h1>
        {isAdmin && <Button label="+ Nuevo país" onClick={openCreate} shadow />}
      </div>

      {loading ? <Loading /> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Alpha3</th>
                <th>Moneda</th>
                <th>Tel.</th>
                <th>Estado</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {countries.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><code>{c.code}</code></td>
                  <td>{c.codeAlpha3 ?? '—'}</td>
                  <td>{c.currencyCode ?? '—'}</td>
                  <td>{c.phoneCode ?? '—'}</td>
                  <td><Badge label={c.active ? 'Activo' : 'Inactivo'} variant={c.active ? 'active' : 'inactive'} /></td>
                  {isAdmin && (
                    <td>
                      <Dropdown items={[
                        { label: 'Editar', onClick: () => openEdit(c), icon: '/icons/edit.svg' },
                        { label: 'Eliminar', onClick: () => handleDelete(c.id), variant: 'danger', icon: '/icons/trash.svg' },
                      ]} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {countries.length === 0 && <p className={styles.empty}>No hay países registrados.</p>}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar país' : 'Nuevo país'} size="md" footer={footer}>
        <div className={styles.form}>
          <label className={styles.label}>
            Nombre
            <input className={styles.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </label>
          <div className={styles.row}>
            <label className={styles.label}>
              Código (2 letras)
              <input className={styles.input} value={form.code} maxLength={2} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
            </label>
            <label className={styles.label}>
              Alpha3 (3 letras)
              <input className={styles.input} value={form.codeAlpha3 ?? ''} maxLength={3} onChange={e => setForm(p => ({ ...p, codeAlpha3: e.target.value.toUpperCase() }))} />
            </label>
          </div>
          <div className={styles.row}>
            <label className={styles.label}>
              Moneda
              <input className={styles.input} value={form.currencyCode ?? ''} maxLength={3} onChange={e => setForm(p => ({ ...p, currencyCode: e.target.value.toUpperCase() }))} />
            </label>
            <label className={styles.label}>
              Código tel.
              <input className={styles.input} value={form.phoneCode ?? ''} onChange={e => setForm(p => ({ ...p, phoneCode: e.target.value }))} />
            </label>
          </div>
          {editing && (
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.active ?? true} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              Activo
            </label>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </Modal>
    </main>
  );
}
