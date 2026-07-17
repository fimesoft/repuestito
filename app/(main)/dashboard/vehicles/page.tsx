'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import {
  getVehicleModels, createVehicleModel, updateVehicleModel, deleteVehicleModel,
  VehicleModel,
} from '@/services/vehicle-model.service';
import { usePermissions } from '@/hooks/usePermissions';
import styles from './page.module.css';

import { COMPATIBILITY_COUNTRIES, CompatibilityCountry } from '@/lib/compatibility-countries';

const EMPTY = { brand: '', model: '', yearFrom: '', yearTo: '', country: '' as CompatibilityCountry | '' };

export default function VehiclesPage() {
  const { canManage } = usePermissions();
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [search, setSearch] = useState('');

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY);

  const [editingModel, setEditingModel] = useState<VehicleModel | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    getVehicleModels().then(setModels);
  }, []);

  const [countryFilter, setCountryFilter] = useState<CompatibilityCountry | ''>('');

  const visible = models.filter(m =>
    (m.brand.toLowerCase().includes(search.toLowerCase()) ||
    m.model.toLowerCase().includes(search.toLowerCase())) &&
    (!countryFilter || m.country === countryFilter),
  );

  function openCreate() {
    setCreateForm(EMPTY);
    setModalError(null);
    setCreating(true);
  }

  async function handleCreate() {
    setSaving(true);
    setModalError(null);
    try {
      const created = await createVehicleModel({
        brand: createForm.brand,
        model: createForm.model,
        yearFrom: Number(createForm.yearFrom),
        yearTo: Number(createForm.yearTo),
        country: createForm.country as string,
      });
      setModels(prev => [...prev, created].sort((a, b) => a.brand.localeCompare(b.brand)));
      setCreating(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(vm: VehicleModel) {
    setEditingModel(vm);
    setEditForm({ brand: vm.brand, model: vm.model, yearFrom: String(vm.yearFrom), yearTo: String(vm.yearTo), country: vm.country as CompatibilityCountry });
    setModalError(null);
  }

  async function handleEdit() {
    if (!editingModel) return;
    setSaving(true);
    setModalError(null);
    try {
      const updated = await updateVehicleModel(editingModel.id, {
        brand: editForm.brand,
        model: editForm.model,
        yearFrom: Number(editForm.yearFrom),
        yearTo: Number(editForm.yearTo),
        country: editForm.country as string,
      });
      setModels(prev => prev.map(m => m.id === updated.id ? updated : m));
      setEditingModel(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este modelo?')) return;
    try {
      await deleteVehicleModel(id);
      setModels(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const createFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setCreating(false)} disabled={saving} />
      <Button
        label={saving ? 'Guardando...' : 'Crear'}
        color="primary"
        onClick={handleCreate}
        disabled={saving || !createForm.brand || !createForm.model || !createForm.yearFrom || !createForm.yearTo || !createForm.country}
      />
    </>
  );

  const editFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setEditingModel(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleEdit} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Modelos de vehículos</h1>
        {canManage && <Button label="+ Nuevo modelo" onClick={openCreate} shadow />}
      </div>

      <div className={styles.controls}>
        <input
          className={styles.search}
          placeholder="Buscar por marca o modelo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.search} style={{ width: 'auto' }} value={countryFilter} onChange={e => setCountryFilter(e.target.value as CompatibilityCountry | '')}>
          <option value="">Todos los países</option>
          {COMPATIBILITY_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Año desde</th>
              <th>Año hasta</th>
              <th>País</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(vm => (
              <tr key={vm.id}>
                <td>{vm.brand}</td>
                <td>{vm.model}</td>
                <td className={styles.tdMeta}>{vm.yearFrom}</td>
                <td className={styles.tdMeta}>{vm.yearTo}</td>
                <td className={styles.tdMeta}>{vm.country}</td>
                <td className={styles.tdActions}>
                  {canManage && <button className={styles.btnText} onClick={() => openEdit(vm)}>Editar</button>}
                  {canManage && <button className={styles.btnDanger} onClick={() => handleDelete(vm.id)}>Eliminar</button>}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className={styles.empty}>No hay modelos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Nuevo modelo" size="md" footer={createFooter}>
        <div className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Marca
              <input className={styles.formInput} value={createForm.brand} onChange={e => setCreateForm(p => ({ ...p, brand: e.target.value }))} />
            </label>
            <label className={styles.formLabel}>
              Modelo
              <input className={styles.formInput} value={createForm.model} onChange={e => setCreateForm(p => ({ ...p, model: e.target.value }))} />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Año desde
              <input className={styles.formInput} type="number" value={createForm.yearFrom} onChange={e => setCreateForm(p => ({ ...p, yearFrom: e.target.value }))} placeholder="2013" />
            </label>
            <label className={styles.formLabel}>
              Año hasta
              <input className={styles.formInput} type="number" value={createForm.yearTo} onChange={e => setCreateForm(p => ({ ...p, yearTo: e.target.value }))} placeholder="2019" />
            </label>
          </div>
          <label className={styles.formLabel}>
            País
            <select className={styles.formInput} value={createForm.country} onChange={e => setCreateForm(p => ({ ...p, country: e.target.value as CompatibilityCountry }))}>
              <option value="">Seleccionar país</option>
              {COMPATIBILITY_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>

      <Modal isOpen={!!editingModel} onClose={() => setEditingModel(null)} title="Editar modelo" size="md" footer={editFooter}>
        <div className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Marca
              <input className={styles.formInput} value={editForm.brand} onChange={e => setEditForm(p => ({ ...p, brand: e.target.value }))} />
            </label>
            <label className={styles.formLabel}>
              Modelo
              <input className={styles.formInput} value={editForm.model} onChange={e => setEditForm(p => ({ ...p, model: e.target.value }))} />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Año desde
              <input className={styles.formInput} type="number" value={editForm.yearFrom} onChange={e => setEditForm(p => ({ ...p, yearFrom: e.target.value }))} />
            </label>
            <label className={styles.formLabel}>
              Año hasta
              <input className={styles.formInput} type="number" value={editForm.yearTo} onChange={e => setEditForm(p => ({ ...p, yearTo: e.target.value }))} />
            </label>
          </div>
          <label className={styles.formLabel}>
            País
            <select className={styles.formInput} value={editForm.country} onChange={e => setEditForm(p => ({ ...p, country: e.target.value as CompatibilityCountry }))}>
              <option value="">Seleccionar país</option>
              {COMPATIBILITY_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>
    </main>
  );
}
