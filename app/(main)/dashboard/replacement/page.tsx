'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import ImageUpload from '@/components/ui/ImageUpload';
import {
  getReplacements, createReplacement, deleteReplacement,
  Replacement, CreateReplacementPayload,
} from '@/services/replacement.service';
import { getTenants, Tenant } from '@/services/tenant.service';
import { getBranches, Branch } from '@/services/branch.service';
import { useCountry } from '@/context/CountryContext';
import styles from './page.module.css';

const EMPTY: Omit<CreateReplacementPayload, 'country'> = {
  name: '', brand: '', price: 0, tenantId: '',
};

export default function ReplacementDashboardPage() {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [formBranches, setFormBranches] = useState<Branch[]>([]);

  const { country } = useCountry();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<CreateReplacementPayload, 'country'>>(EMPTY);
  const [priceInput, setPriceInput] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getReplacements({}, { cache: 'no-store' } as RequestInit).then(r => setReplacements(r.data));
    getTenants().then(setTenants);
  }, []);

  function set(field: Partial<CreateReplacementPayload>) {
    setForm(p => ({ ...p, ...field }));
  }

  async function onTenantChange(tenantId: string) {
    setForm(({ branchId: _b, latitude: _lat, longitude: _lng, ...rest }) => ({ ...rest, tenantId, branchId: '' }));
    if (!tenantId) { setFormBranches([]); return; }
    const data = await getBranches(tenantId);
    setFormBranches(data);
  }

  function openCreate() {
    setForm(EMPTY);
    setPriceInput('');
    setImageUrl(null);
    setFormBranches([]);
    setFormError(null);
    setCreating(true);
  }

  async function handleCreate() {
    if (!form.tenantId) { setFormError('Selecciona un local'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: CreateReplacementPayload = {
        ...form,
        country,
        ...(imageUrl ? { imageUrl } : {}),
      };
      const created = await createReplacement(payload);
      setReplacements(prev => [created, ...prev]);
      setCreating(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este repuesto?')) return;
    try {
      await deleteReplacement(id);
      setReplacements(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const footer = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setCreating(false)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleCreate} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Repuestos</h1>
        <Button label="+ Nuevo repuesto" onClick={openCreate} shadow />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Nombre</th>
              <th>Marca</th>
              <th>Precio</th>
              <th>País</th>
              <th>Stock</th>
              <th>Local</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {replacements.map(r => (
              <tr key={r.id}>
                <td className={styles.tdImg}>
                  {r.imageUrl
                    ? <Image src={r.imageUrl} alt={r.name} width={40} height={40} className={styles.img} />
                    : <div className={styles.imgPlaceholder} />}
                </td>
                <td className={styles.tdName}>{r.name}</td>
                <td className={styles.tdMeta}>{r.brand}</td>
                <td className={styles.tdMeta}>${Number(r.price).toFixed(2)}</td>
                <td className={styles.tdMeta}>{r.country}</td>
                <td className={styles.tdMeta}>{r.stock}</td>
                <td className={styles.tdMeta}>
                  {tenants.find(t => t.id === r.tenantId)?.businessName ?? '—'}
                </td>
                <td className={styles.tdActions}>
                  <button className={styles.btnDanger} onClick={() => handleDelete(r.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {replacements.length === 0 && (
              <tr><td colSpan={8} className={styles.empty}>No hay repuestos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Nuevo repuesto" size="lg" footer={footer}>
        <div className={styles.form}>
          <label className={styles.label}>
            Imagen <span className={styles.optional}>(opcional)</span>
            <ImageUpload onUpload={setImageUrl} />
          </label>

          <div className={styles.row}>
            <label className={styles.label}>
              Nombre
              <input className={styles.input} value={form.name} onChange={e => set({ name: e.target.value })} required />
            </label>
            <label className={styles.label}>
              Marca
              <input className={styles.input} value={form.brand} onChange={e => set({ brand: e.target.value })} required />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Precio
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={priceInput}
                onChange={e => {
                  const v = e.target.value;
                  if (/^\d*\.?\d*$/.test(v)) {
                    setPriceInput(v);
                    set({ price: parseFloat(v) || 0 });
                  }
                }}
                placeholder="0.00"
                required
              />
            </label>
            <label className={styles.label}>
              Stock
              <input className={styles.input} type="text" inputMode="numeric" value={form.stock ?? ''} onChange={e => { if (/^\d*$/.test(e.target.value)) set({ stock: Number(e.target.value) }); }} placeholder="0" />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Código OEM <span className={styles.optional}>(opcional)</span>
              <input className={styles.input} value={form.codeOem ?? ''} onChange={e => set({ codeOem: e.target.value })} placeholder="ej. 15400-PLM-A02" />
            </label>
            <label className={styles.label}>
              Local
              <select className={styles.select} value={form.tenantId} onChange={e => onTenantChange(e.target.value)} required>
                <option value="">Seleccionar local</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.businessName}</option>)}
              </select>
            </label>
          </div>

          <label className={styles.label}>
            Sucursal <span className={styles.optional}>(opcional)</span>
            <select
              className={styles.select}
              value={form.branchId ?? ''}
              onChange={e => {
                const branch = formBranches.find(b => b.id === e.target.value);
                set({
                  branchId: e.target.value,
                  ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }),
                });
              }}
              disabled={!form.tenantId}
            >
              <option value="">Sin asignar</option>
              {formBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>

          {formError && <p className={styles.error}>{formError}</p>}
        </div>
      </Modal>
    </main>
  );
}
