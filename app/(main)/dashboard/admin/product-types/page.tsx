'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getProductTypes, updateProductType, deleteProductType, mergeProductType,
  ProductTypeWithCount, PaginatedProductTypes, UpdateProductTypePayload,
} from '@/services/product-types.service';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Badge from '@/components/ui/Badge';
import Dropdown from '@/components/ui/Dropdown';
import Table, { Column } from '@/components/ui/Table';
import Search from '@/components/ui/Search';
import Toggle from '@/components/ui/Toggle';
import Autocomplete from '@/components/ui/Autocomplete';
import Label from '@/components/ui/Label';
import PageCount from '@/components/shared/PageCount';
import Confirm from '@/components/shared/Confirm';
import Paginator from '@/components/ui/Paginator';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import styles from './page.module.css';

const DEFAULT_LIMIT = 20;

export default function ProductTypesPage() {
  const { isAdmin } = usePermissions();
  const [result, setResult] = useState<PaginatedProductTypes>({ data: [], total: 0, page: 1, limit: DEFAULT_LIMIT, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ProductTypeWithCount | null>(null);
  const [form, setForm] = useState<UpdateProductTypePayload>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<ProductTypeWithCount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [merging, setMerging] = useState<ProductTypeWithCount | null>(null);
  const [mergeText, setMergeText] = useState('');
  const [mergeSuggestions, setMergeSuggestions] = useState<ProductTypeWithCount[]>([]);
  const [mergeTarget, setMergeTarget] = useState<ProductTypeWithCount | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // `loading` se activa en los handlers (no aquí) para no llamar setState dentro del efecto.
  const load = useCallback((p: number, l: number, s: string, unverified: boolean) => {
    getProductTypes({ page: p, limit: l, search: s || undefined, isVerified: unverified ? false : undefined })
      .then(setResult)
      .catch(err => setActionError(err instanceof Error ? err.message : 'Error al cargar los tipos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, limit, search, onlyUnverified); }, [page, limit, search, onlyUnverified, load]);

  function handleSearch(value: string) { setLoading(true); setSearch(value); setPage(1); }
  function handleLimit(value: number) { setLoading(true); setLimit(value); setPage(1); }
  function handleUnverified(value: boolean) { setLoading(true); setOnlyUnverified(value); setPage(1); }
  function handlePage(value: number) { setLoading(true); setPage(value); }
  const reload = () => { setLoading(true); load(page, limit, search, onlyUnverified); };

  function openEdit(t: ProductTypeWithCount) {
    setEditing(t);
    setForm({ name: t.name, isVerified: t.isVerified, isActive: t.isActive, supportsVehicleCompatibility: t.supportsVehicleCompatibility });
    setFormError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateProductType(editing.id, form);
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify(t: ProductTypeWithCount) {
    setActionError(null);
    try {
      await updateProductType(t.id, { isVerified: true });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al verificar');
    }
  }

  async function handleDelete() {
    if (!deleting) return false;
    setDeleteError(null);
    try {
      await deleteProductType(deleting.id);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar');
      return false;
    }
  }

  function openMerge(t: ProductTypeWithCount) {
    setMerging(t);
    setMergeText('');
    setMergeSuggestions([]);
    setMergeTarget(null);
    setMergeError(null);
  }

  const searchMergeTargets = useCallback(
    (query: string) => {
      getProductTypes({ search: query, isActive: true, limit: 10 })
        .then(r => setMergeSuggestions(r.data.filter(t => t.id !== merging?.id)))
        .catch(() => setMergeSuggestions([]));
    },
    [merging?.id],
  );

  async function handleMerge() {
    if (!merging || !mergeTarget) return;
    setSaving(true);
    setMergeError(null);
    try {
      await mergeProductType(merging.id, mergeTarget.id);
      setMerging(null);
      reload();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Error al fusionar');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<ProductTypeWithCount>[] = [
    {
      header: 'Nombre',
      render: t => (
        <span className={styles.nameCell}>
          {t.name}
          {t.isSystem && <Badge label="Sistema" variant="info" />}
        </span>
      ),
    },
    { header: 'Productos', render: t => t.productsCount },
    { header: 'Compatibilidad vehicular', render: t => <Badge label={t.supportsVehicleCompatibility ? 'Sí' : 'No'} variant={t.supportsVehicleCompatibility ? 'active' : 'neutral'} /> },
    { header: 'Verificado', render: t => <Badge label={t.isVerified ? 'Sí' : 'No'} variant={t.isVerified ? 'active' : 'warning'} /> },
    { header: 'Estado', render: t => <Badge label={t.isActive ? 'Activo' : 'Inactivo'} variant={t.isActive ? 'active' : 'inactive'} /> },
    ...(isAdmin ? [{
      header: '',
      render: (t: ProductTypeWithCount) => (
        <Dropdown items={[
          { label: 'Editar', onClick: () => openEdit(t), icon: '/icons/edit.svg' },
          ...(!t.isVerified ? [{ label: 'Verificar', onClick: () => handleVerify(t), icon: '/icons/check.svg' }] : []),
          ...(!t.isSystem ? [{ label: 'Fusionar en…', onClick: () => openMerge(t), icon: '/icons/layers.svg' }] : []),
          ...(!t.isSystem && t.productsCount === 0
            ? [{ label: 'Eliminar', onClick: () => { setDeleteError(null); setDeleting(t); }, variant: 'danger' as const, icon: '/icons/trash.svg' }]
            : []),
        ]} />
      ),
    }] : []),
  ];

  const editFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setEditing(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} onClick={handleSave} disabled={saving || !form.name?.trim()} />
    </>
  );

  const mergeFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setMerging(null)} disabled={saving} />
      <Button label={saving ? 'Fusionando...' : 'Fusionar'} color="danger" onClick={handleMerge} disabled={saving || !mergeTarget} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Breadcrumbs items={[{ label: 'Tipos de producto' }]} />
          <MainTitle title="Tipos de producto" subtitle="Revisa, verifica y ordena los tipos que crean los moderadores" />
        </div>
      </div>

      <div className={styles.toolbar}>
        <Search value={search} onChange={handleSearch} placeholder="Buscar por nombre..." />
        <Toggle checked={onlyUnverified} onChange={handleUnverified} label="Solo sin verificar" />
        <PageCount total={result.total} limit={limit} onLimitChange={handleLimit} />
      </div>

      {actionError && <p className={styles.error}>{actionError}</p>}

      {loading ? <Loading /> : (
        <>
          <Table
            columns={columns}
            rows={result.data}
            getKey={t => t.id}
            emptyMessage={onlyUnverified ? 'No hay tipos pendientes de verificación.' : 'No hay tipos registrados.'}
          />
          {result.totalPages > 1 && (
            <Paginator currentPage={page} totalPages={result.totalPages} onPageChange={handlePage} />
          )}
        </>
      )}

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar tipo" size="md" footer={editFooter}>
        <div className={styles.form}>
          <Label text="Nombre">
            <input className={styles.input} value={form.name ?? ''} maxLength={100} disabled={editing?.isSystem} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </Label>
          <Toggle checked={form.isVerified ?? false} onChange={v => setForm(p => ({ ...p, isVerified: v }))} label="Verificado" />
          <Toggle checked={form.isActive ?? true} onChange={v => setForm(p => ({ ...p, isActive: v }))} label="Activo" description="Un tipo inactivo no aparece al crear productos." disabled={editing?.isSystem} />
          <Toggle
            checked={form.supportsVehicleCompatibility ?? false}
            onChange={v => setForm(p => ({ ...p, supportsVehicleCompatibility: v }))}
            label="Soporta compatibilidad vehicular"
            description="Permite asociar los productos de este tipo a modelos de vehículo."
          />
          {formError && <p className={styles.error}>{formError}</p>}
        </div>
      </Modal>

      <Modal isOpen={!!merging} onClose={() => setMerging(null)} title={`Fusionar «${merging?.name ?? ''}» en otro tipo`} size="md" footer={mergeFooter}>
        <div className={styles.form}>
          <Label text="Tipo destino">
            <Autocomplete<ProductTypeWithCount>
              value={mergeText}
              onChange={v => { setMergeText(v); setMergeTarget(null); }}
              onSearch={searchMergeTargets}
              onSelect={t => { setMergeTarget(t); setMergeText(t.name); }}
              suggestions={mergeSuggestions}
              getLabel={t => t.name}
              getKey={t => t.id}
              placeholder="Buscar tipo..."
              minChars={2}
            />
          </Label>
          {mergeTarget && merging && (
            <p className={styles.hint}>
              Se moverán {merging.productsCount} {merging.productsCount === 1 ? 'producto' : 'productos'} a «{mergeTarget.name}» y se eliminará «{merging.name}». Esta acción no se puede deshacer.
            </p>
          )}
          {mergeError && <p className={styles.error}>{mergeError}</p>}
        </div>
      </Modal>

      <Confirm
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminar tipo"
        message={
          <>
            <p>¿Eliminar el tipo «{deleting?.name}»?</p>
            {deleteError && <p className={styles.error}>{deleteError}</p>}
          </>
        }
        confirmLabel="Eliminar"
        loadingLabel="Eliminando…"
        confirmColor="danger"
        successMessage="El tipo se eliminó correctamente."
      />
    </main>
  );
}
