'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getCountries, createCountry, updateCountry, deleteCountry,
  Country, CreateCountryPayload, UpdateCountryPayload, PaginatedCountries,
} from '@/services/country.service';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import Badge from '@/components/ui/Badge';
import Dropdown from '@/components/ui/Dropdown';
import Search from '@/components/ui/Search';
import PageCount from '@/components/shared/PageCount';
import Paginator from '@/components/ui/Paginator';
import styles from './page.module.css';

const DEFAULT_LIMIT = 20;

export default function CountriesPage() {
  const { isAdmin } = usePermissions();
  const [result, setResult] = useState<PaginatedCountries>({ data: [], total: 0, page: 1, limit: DEFAULT_LIMIT, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [form, setForm] = useState<CreateCountryPayload>({ name: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: number, l: number, s: string) => {
    setLoading(true);
    getCountries({ page: p, limit: l, search: s || undefined })
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, limit, search); }, [page, limit, search, load]);

  function handleSearch(value: string) { setSearch(value); setPage(1); }
  function handleLimit(value: number) { setLimit(value); setPage(1); }

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
        await updateCountry(editing.id, form as UpdateCountryPayload);
      } else {
        await createCountry(form);
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
    if (!confirm('¿Eliminar este país?')) return;
    try {
      await deleteCountry(id);
      load(page, limit, search);
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

      <div className={styles.toolbar}>
        <Search value={search} onChange={handleSearch} placeholder="Buscar por nombre o código..." />
        <PageCount total={result.total} limit={limit} onLimitChange={handleLimit} />
      </div>

      {loading ? <Loading /> : (
        <>
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
                {result.data.map(c => (
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
            {result.data.length === 0 && <p className={styles.empty}>No hay países registrados.</p>}
          </div>

          {result.totalPages > 1 && (
            <Paginator currentPage={page} totalPages={result.totalPages} onPageChange={setPage} />
          )}
        </>
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
