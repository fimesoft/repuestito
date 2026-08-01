'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import ImageUpload from '@/components/ui/ImageUpload';
import {
  getReplacements, createReplacement, updateReplacement, deleteReplacement,
  Replacement, CreateReplacementPayload, UpdateReplacementPayload,
} from '@/services/replacement.service';
import { getTenants, Tenant } from '@/services/tenant.service';
import { getBranches, Branch } from '@/services/branch.service';
import { getBrands, Brand } from '@/services/brands.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useCountry } from '@/context/CountryContext';
import styles from './page.module.css';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';

const EMPTY: Omit<CreateReplacementPayload, 'countryCode'> = {
  name: '', brandId: 0, price: 0, tenantId: '',
};

interface EditFormState extends UpdateReplacementPayload {
  tenantId: string;
  branchId?: string;
}

const EMPTY_EDIT: EditFormState = { price: 0, stock: 0, tenantId: '' };

export default function ReplacementDashboardPage() {
  const router = useRouter();
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [formBranches, setFormBranches] = useState<Branch[]>([]);

  const { country } = useCountry();
  const { currentUser, isAdmin, canManage } = usePermissions();
  const visibleTenants = isAdmin ? tenants : tenants.filter(t => t.id === currentUser?.tenantId);
  const [search, setSearch] = useState('');
  const visibleReplacements = replacements.filter(r =>
    !search || r.globalReplacement?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<CreateReplacementPayload, 'countryCode'>>(EMPTY);
  const [priceInput, setPriceInput] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingReplacement, setEditingReplacement] = useState<Replacement | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT);
  const [editPriceInput, setEditPriceInput] = useState('');
  const [editBranches, setEditBranches] = useState<Branch[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    getReplacements({ country }).then(r => setReplacements(r.data));
  }, [country]);

  useEffect(() => {
    getTenants(country).then(setTenants);
  }, [country]);

  useEffect(() => {
    getBrands(country ?? undefined).then(setBrands);
  }, [country]);

  function set(field: Partial<CreateReplacementPayload>) {
    setForm(p => ({ ...p, ...field }));
  }

  function setEdit(field: Partial<EditFormState>) {
    setEditForm(p => ({ ...p, ...field }));
  }

  async function onTenantChange(tenantId: string) {
    setForm(({ branchId: _b, latitude: _lat, longitude: _lng, ...rest }) => ({ ...rest, tenantId, branchId: '' }));
    if (!tenantId) { setFormBranches([]); return; }
    const data = await getBranches(tenantId);
    setFormBranches(data);
  }

  async function openCreate() {
    const tenantId = !isAdmin && currentUser?.tenantId ? currentUser.tenantId : '';
    setForm({ ...EMPTY, tenantId });
    setPriceInput('');
    setImageUrl(null);
    setFormBranches([]);
    setFormError(null);
    setCreating(true);
    if (tenantId) {
      const branches = await getBranches(tenantId);
      setFormBranches(branches);
      if (branches.length === 1) {
        const b = branches[0];
        set({
          branchId: b.id,
          ...(b.latitude != null && b.longitude != null && { latitude: b.latitude, longitude: b.longitude }),
        });
      }
    }
  }

  async function openEdit(r: Replacement) {
    setEditForm({ price: r.price, stock: r.stock, tenantId: r.tenantId, branchId: r.branchId ?? '' });
    setEditPriceInput(String(r.price));
    setEditBranches([]);
    setEditError(null);
    if (r.tenantId) {
      const data = await getBranches(r.tenantId);
      setEditBranches(data);
    }
    setEditingReplacement(r);
  }

  async function onEditTenantChange(tenantId: string) {
    setEditForm(({ branchId: _b, latitude: _lat, longitude: _lng, ...rest }) => ({ ...rest, tenantId, branchId: '' }));
    if (!tenantId) { setEditBranches([]); return; }
    const data = await getBranches(tenantId);
    setEditBranches(data);
  }

  async function handleUpdate() {
    if (!editingReplacement) return;
    setSaving(true);
    setEditError(null);
    try {
      const { tenantId: _t, ...payload } = editForm;
      const updated = await updateReplacement(editingReplacement.id, payload);
      setReplacements(prev => prev.map(r => r.id === updated.id ? updated : r));
      setEditingReplacement(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!form.tenantId) { setFormError('Selecciona un local'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: CreateReplacementPayload = {
        ...form,
        countryCode: country ?? '',
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

  const canCreate = !!form.name && form.brandId > 0 && form.price > 0 && !!form.tenantId;

  const footer = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setCreating(false)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleCreate} disabled={saving || !canCreate} />
    </>
  );

  const editFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setEditingReplacement(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleUpdate} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Repuestos</h1>
          <p className={styles.subtitle}>Catálogo de piezas disponibles en tu red de locales</p>
        </div>
        {canManage && <Button label="+ Nuevo repuesto" onClick={openCreate} shadow />}
      </div>

      <div className={styles.controls}>
        <Search value={search} onChange={setSearch} placeholder="Buscar por nombre de repuesto..." />
      </div>

      <Table<Replacement>
        rows={visibleReplacements}
        getKey={r => r.id}
        emptyMessage="No hay repuestos registrados."
        onRowClick={r => router.push(`/dashboard/replacement/${r.id}/show`)}
        columns={[
          { header: 'Producto', render: r => r.globalReplacement?.imageUrl
            ? <Image src={r.globalReplacement.imageUrl} alt={r.globalReplacement.name ?? ''} width={40} height={40} className={styles.img} />
            : <div className={styles.imgPlaceholder} />, className: styles.tdImg },
          { header: 'Nombre', render: r => r.globalReplacement?.name, className: styles.tdName },
          { header: 'Marca', render: r => r.globalReplacement?.brand?.name, className: styles.tdMeta },
          { header: 'Precio', render: r => `$${Number(r.price).toFixed(2)}`, className: styles.tdPrice },
          ...(isAdmin ? [{ header: 'País', render: (r: Replacement) => r.globalReplacement?.countryCode, className: styles.tdMeta } as Column<Replacement>] : []),
          { header: 'Stock', render: r => <span className={r.stock > 0 ? styles.badgeActive : styles.badgeOut}>{r.stock}</span> },
          { header: 'Estado', render: r => <span className={r.stock > 0 ? styles.badgeActive : styles.badgeOut}>{r.stock > 0 ? 'Activo' : 'Agotado'}</span> },
          { header: 'Local', render: r => tenants.find(t => t.id === r.tenantId)?.businessName ?? '—', className: styles.tdMeta },
          { header: '', render: r => (
            <div onClick={e => e.stopPropagation()}>
              <Link href={`/dashboard/replacement/${r.id}`} className={styles.btnText}>Compatibilidades</Link>
              {canManage && <Button label="Editar" variant="ghost" color="neutral" size="sm" onClick={() => openEdit(r)} />}
              {canManage && <Button label="Eliminar" variant="ghost" color="danger" size="sm" onClick={() => handleDelete(r.id)} />}
            </div>
          ), className: styles.tdActions },
        ]}
      />

      <Modal isOpen={!!editingReplacement} onClose={() => setEditingReplacement(null)} title="Editar repuesto" size="lg" footer={editFooter}>
        <div className={styles.form}>
          {editingReplacement && (
            <div className={styles.row}>
              <div className={styles.label}>
                Nombre
                <p className={styles.readOnly}>{editingReplacement.globalReplacement?.name}</p>
              </div>
              <div className={styles.label}>
                Marca
                <p className={styles.readOnly}>{editingReplacement.globalReplacement?.brand?.name}</p>
              </div>
            </div>
          )}

          <div className={styles.row}>
            <label className={styles.label}>
              Precio
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={editPriceInput}
                onChange={e => {
                  const v = e.target.value;
                  if (/^\d*\.?\d*$/.test(v)) {
                    setEditPriceInput(v);
                    setEdit({ price: parseFloat(v) || 0 });
                  }
                }}
                placeholder="0.00"
                required
              />
            </label>
            <label className={styles.label}>
              Stock
              <input className={styles.input} type="text" inputMode="numeric" value={editForm.stock ?? ''} onChange={e => { if (/^\d*$/.test(e.target.value)) setEdit({ stock: Number(e.target.value) }); }} placeholder="0" />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Local
              <Select value={editForm.tenantId} onChange={onEditTenantChange} options={tenants.map(t => ({ value: t.id, label: t.businessName }))} placeholder="Seleccionar local" required />
            </label>
            <label className={styles.label}>
              Sucursal <span className={styles.optional}>(opcional)</span>
              <Select
                value={editForm.branchId ?? ''}
                onChange={v => {
                  const branch = editBranches.find(b => b.id === v);
                  setEdit({ branchId: v, ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }) });
                }}
                options={editBranches.map(b => ({ value: b.id, label: b.name }))}
                placeholder="Sin asignar"
                disabled={!editForm.tenantId}
              />
            </label>
          </div>

          {editError && <p className={styles.error}>{editError}</p>}
        </div>
      </Modal>

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Nuevo repuesto" size="lg" footer={footer}>
        <div className={styles.form}>
          <div className={styles.label}>
            Imagen <span className={styles.optional}>(opcional)</span>
            <ImageUpload onUpload={setImageUrl} />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Nombre
              <input className={styles.input} value={form.name} onChange={e => set({ name: e.target.value })} required />
            </label>
            <label className={styles.label}>
              Marca
              <Select value={form.brandId || ''} onChange={v => set({ brandId: Number(v) || 0 })} options={brands.map(b => ({ value: b.id, label: b.name }))} placeholder="Seleccionar marca" required />
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
              <Select value={form.tenantId} onChange={onTenantChange} options={visibleTenants.map(t => ({ value: t.id, label: t.businessName }))} placeholder="Seleccionar local" disabled={!isAdmin} required />
            </label>
          </div>

          <label className={styles.label}>
            Sucursal <span className={styles.optional}>(opcional)</span>
            <Select
              value={form.branchId ?? ''}
              onChange={v => {
                const branch = formBranches.find(b => b.id === v);
                set({ branchId: v, ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }) });
              }}
              options={formBranches.map(b => ({ value: b.id, label: b.name }))}
              placeholder="Sin asignar"
              disabled={!form.tenantId}
            />
          </label>

          {formError && <p className={styles.error}>{formError}</p>}
        </div>
      </Modal>
    </main>
  );
}
