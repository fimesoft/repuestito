'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import ImageUpload from '@/components/ui/ImageUpload';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import ViewToggle from '@/components/ui/ViewToggle';
import Toggle from '@/components/ui/Toggle';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import PageCount from '@/components/shared/PageCount';
import Loading from '@/components/ui/Loading';
import Dropdown from '@/components/ui/Dropdown';
import PartCard from '@/components/features/replacements/PartCard';

import {
  getReplacements, createReplacement, updateReplacement, deleteReplacement,
  Replacement, CreateReplacementPayload, UpdateReplacementPayload,
} from '@/services/replacement.service';
import { getTenants, Tenant } from '@/services/tenant.service';
import { getBranches, Branch } from '@/services/branch.service';
import { getBrands, Brand } from '@/services/brands.service';

import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import { useCountry } from '@/context/CountryContext';

import { getStockLevel } from '@/constants/replacement';
import { formatDateTime } from '@/lib/date';
import styles from './page.module.css';

const EMPTY: Omit<CreateReplacementPayload, 'countryCode'> = {
  name: '', brandId: 0, price: 0, tenantId: '',
};

interface EditFormState extends UpdateReplacementPayload {
  tenantId: string;
  branchId?: string;
}

const EMPTY_EDIT: EditFormState = { price: 0, stock: 0, active: true, tenantId: '' };

const DEFAULT_LIMIT = 10;

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
  const debouncedSearch = useDebounce(search, 600);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

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
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoadError(false);
    setLoading(true);
    getReplacements({ country, page, limit, search: debouncedSearch })
      .then(r => {
        setReplacements(r.data);
        setTotalPages(r.totalPages);
        setTotal(r.total);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [country, page, debouncedSearch, limit]);

  useEffect(() => {
    setPage(1);
  }, [country, debouncedSearch, limit]);

  useEffect(() => {
    getTenants(country).then(setTenants);
  }, [country]);

  useEffect(() => {
    getBrands({ countryCode: country ?? undefined, limit: 100 }).then(r => setBrands(r.data));
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
    setEditForm({ price: r.price, stock: r.stock, active: r.active ?? true, tenantId: r.tenantId, branchId: r.branchId ?? '' });
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

  function handleActiveToggle(value: boolean) {
    if (!value) {
      setShowDeactivateConfirm(true);
    } else {
      setEdit({ active: true });
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
  const modalOpen = creating || !!editingReplacement;
  const modalTitle = creating ? 'Nuevo repuesto' : 'Editar repuesto';
  const modalClose = creating ? () => setCreating(false) : () => setEditingReplacement(null);
  const modalSave = creating ? handleCreate : handleUpdate;
  const modalCanDisable = creating ? (saving || !canCreate) : saving;

  const listEmptyMessage = loadError ? (
    <EmptyState variant="error" />
  ) : (
    <EmptyState
      variant={search ? 'no-results' : 'empty'}
      title={search ? 'Sin repuestos para tu búsqueda' : 'No hay repuestos registrados'}
      description={search
        ? 'No encontramos repuestos que coincidan con tu búsqueda. Probá con otro nombre, marca o código.'
        : 'Aún no tienes repuestos registrados. Cuando ingresen, aparecerán aquí.'}
    />
  );

  const modalFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={modalClose} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={modalSave} disabled={modalCanDisable} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Breadcrumbs items={[{ label: 'Repuestos' }]} />
          <MainTitle title="Repuestos" subtitle="Catálogo de piezas disponibles en tu red de locales" />
        </div>
        {canManage && <Button label="+ Nuevo repuesto" onClick={openCreate} shadow />}
      </div>

      <div className={styles.controls}>
        <Search value={search} onChange={setSearch} placeholder="Buscar por nombre de repuesto..." />
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      <div className={styles.subControls}>
        <PageCount total={total} limit={limit} onLimitChange={setLimit} />
      </div>
      {loading ? (
        <Loading />
      ) : viewMode === 'table' ? (
        <Table<Replacement>
          rows={replacements}
          getKey={r => r.id}
          emptyMessage={listEmptyMessage}
          onRowClick={r => router.push(`/dashboard/replacement/${r.id}/show`)}
          columns={[
            { header: 'Producto', render: r => r.globalReplacement?.imageUrl
              ? <Image src={r.globalReplacement.imageUrl} alt={`${r.globalReplacement.name ?? 'Repuesto'} - ${r.globalReplacement.brand?.name ?? ''}`} title={`${r.globalReplacement.name ?? 'Repuesto'} - ${r.globalReplacement.brand?.name ?? ''}`} width={40} height={40} className={styles.img} />
              : <div className={styles.imgPlaceholder} />, className: styles.tdImg },
            { header: 'Nombre / Marca', render: r => (
              <div className={styles.nameCell}>
                <span className={styles.namePrimary}>{r.globalReplacement?.name}</span>
                <span className={styles.nameSecondary}>{r.globalReplacement?.brand?.name}</span>
              </div>
            ), className: styles.tdName },
            { header: 'Precio', render: r => `$${Number(r.price).toFixed(2)}`, className: styles.tdPrice },
            ...(isAdmin ? [{ header: 'País', render: (r: Replacement) => r.globalReplacement?.countryCode, className: styles.tdMeta } as Column<Replacement>] : []),
            { header: 'Stock', render: r => {
              const STOCK_VARIANT: Record<string, BadgeVariant> = { low: 'inactive', normal: 'seller', full: 'active' };
              return <Badge label={`${r.stock} u.`} variant={STOCK_VARIANT[getStockLevel(r.stock)]} />;
            }},
            { header: 'Sucursal', render: r => r.branch?.name ?? '—', className: styles.tdMeta },
            { header: 'Fecha', render: r => formatDateTime(r.createdAt), className: styles.tdMeta },
            { header: 'Estado', render: r => <Badge label={r.active !== false ? 'Activo' : 'Inactivo'} variant={r.active !== false ? 'active' : 'neutral'} /> },
            { header: '', render: r => (
              <div onClick={e => e.stopPropagation()}>
                <Dropdown items={[
                  { label: 'Ver', onClick: () => router.push(`/dashboard/replacement/${r.id}/show`), icon: '/icons/eye.svg' },
                  { label: 'Compatibilidades', onClick: () => router.push(`/dashboard/replacement/${r.id}`), icon: '/icons/link.svg' },
                  ...(canManage ? [
                    { label: 'Editar', onClick: () => openEdit(r), icon: '/icons/edit.svg' },
                    { label: 'Eliminar', onClick: () => handleDelete(r.id), variant: 'danger' as const, icon: '/icons/trash.svg' },
                  ] : []),
                ]} />
              </div>
            ), className: styles.tdActions },
          ]}
        />
      ) : (
        <div className={styles.grid}>
          {replacements.map(r => (
            <PartCard
              key={r.id}
              id={r.id}
              image={r.globalReplacement?.imageUrl ?? null}
              brand={r.globalReplacement?.brand?.name ?? ''}
              name={r.globalReplacement?.name ?? ''}
              price={r.price}
            />
          ))}
          {replacements.length === 0 && listEmptyMessage}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.paginationWrapper}>
          <button className={styles.pageBtn} onClick={() => setPage(p => p - 1)} disabled={page === 1}>←</button>
          <span className={styles.pageInfo}>{page} / {totalPages}</span>
          <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>→</button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={modalClose} title={modalTitle} size="lg" footer={modalFooter}>
        <div className={styles.form}>
          {creating ? (
            <>
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
                  <input className={styles.input} type="text" inputMode="decimal" value={priceInput} onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) { setPriceInput(v); set({ price: parseFloat(v) || 0 }); } }} placeholder="0.00" required />
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
                <Select value={form.branchId ?? ''} onChange={v => { const branch = formBranches.find(b => b.id === v); set({ branchId: v, ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }) }); }} options={formBranches.map(b => ({ value: b.id, label: b.name }))} placeholder="Sin asignar" disabled={!form.tenantId} />
              </label>

              {formError && <p className={styles.error}>{formError}</p>}
            </>
          ) : (
            <>
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
                  <input className={styles.input} type="text" inputMode="decimal" value={editPriceInput} onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) { setEditPriceInput(v); setEdit({ price: parseFloat(v) || 0 }); } }} placeholder="0.00" required />
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
                  <Select value={editForm.branchId ?? ''} onChange={v => { const branch = editBranches.find(b => b.id === v); setEdit({ branchId: v, ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }) }); }} options={editBranches.map(b => ({ value: b.id, label: b.name }))} placeholder="Sin asignar" disabled={!editForm.tenantId} />
                </label>
              </div>

              <Toggle
                checked={editForm.active ?? true}
                onChange={handleActiveToggle}
                label="Estado del repuesto"
                description={editForm.active ? 'Activo — visible en el marketplace' : 'Inactivo — no aparece en búsquedas'}
              />

              {editError && <p className={styles.error}>{editError}</p>}
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        size="sm"
        title="Desactivar repuesto"
        footer={
          <div className={styles.confirmActions}>
            <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setShowDeactivateConfirm(false)} />
            <Button label="Desactivar" variant="solid" color="danger" onClick={() => { setEdit({ active: false }); setShowDeactivateConfirm(false); }} />
          </div>
        }
      >
        <p className={styles.confirmBody}>
          El repuesto <strong>{editingReplacement?.globalReplacement?.name}</strong> dejará de aparecer en el marketplace. Podés volver a activarlo en cualquier momento.
        </p>
      </Modal>
    </main>
  );
}
