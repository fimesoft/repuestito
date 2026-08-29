'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getBrands, createBrand, updateBrand, deleteBrand,
  Brand, CreateBrandPayload, UpdateBrandPayload, PaginatedBrands,
} from '@/services/brands.service';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Badge from '@/components/ui/Badge';
import Dropdown from '@/components/ui/Dropdown';
import Table, { Column } from '@/components/ui/Table';
import Search from '@/components/ui/Search';
import PageCount from '@/components/shared/PageCount';
import Paginator from '@/components/ui/Paginator';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import styles from './page.module.css';

const DEFAULT_LIMIT = 20;

export default function BrandsPage() {
  const { isAdmin } = usePermissions();
  const [result, setResult] = useState<PaginatedBrands>({ data: [], total: 0, page: 1, limit: DEFAULT_LIMIT, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<CreateBrandPayload>({ name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: number, l: number, s: string) => {
    setLoading(true);
    getBrands({ page: p, limit: l, search: s || undefined })
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, limit, search); }, [page, limit, search, load]);

  function handleSearch(value: string) { setSearch(value); setPage(1); }
  function handleLimit(value: number) { setLimit(value); setPage(1); }

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
        await updateBrand(editing.id, form as UpdateBrandPayload);
      } else {
        await createBrand(form);
      }
      setModalOpen(false);
      load(page, limit, search);
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
      load(page, limit, search);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const columns: Column<Brand>[] = [
    { header: 'Nombre', render: b => b.name },
    { header: 'Normalizado', render: b => <code>{b.normalizedName}</code> },
    { header: 'País', render: b => b.countryCode ?? '—' },
    { header: 'Verificada', render: b => <Badge label={b.isVerified ? 'Sí' : 'No'} variant={b.isVerified ? 'active' : 'inactive'} /> },
    { header: 'Estado', render: b => <Badge label={b.isActive ? 'Activo' : 'Inactivo'} variant={b.isActive ? 'active' : 'inactive'} /> },
    ...(isAdmin ? [{
      header: '',
      render: (b: Brand) => (
        <Dropdown items={[
          { label: 'Editar', onClick: () => openEdit(b), icon: '/icons/edit.svg' },
          { label: 'Eliminar', onClick: () => handleDelete(b.id), variant: 'danger' as const, icon: '/icons/trash.svg' },
        ]} />
      ),
    }] : []),
  ];

  const footer = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setModalOpen(false)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleSave} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Breadcrumbs items={[{ label: 'Marcas' }]} />
          <MainTitle title="Marcas" subtitle="Catálogo de marcas de repuestos verificadas" />
        </div>
        {isAdmin && <Button label="+ Nueva marca" onClick={openCreate} shadow />}
      </div>

      <div className={styles.toolbar}>
        <Search value={search} onChange={handleSearch} placeholder="Buscar por nombre..." />
        <PageCount total={result.total} limit={limit} onLimitChange={handleLimit} />
      </div>

      {loading ? <Loading /> : (
        <>
          <Table
            columns={columns}
            rows={result.data}
            getKey={b => b.id}
            emptyMessage="No hay marcas registradas."
          />
          {result.totalPages > 1 && (
            <Paginator currentPage={page} totalPages={result.totalPages} onPageChange={setPage} />
          )}
        </>
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
