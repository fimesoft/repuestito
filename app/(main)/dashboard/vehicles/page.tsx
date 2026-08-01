'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import {
  getVehicleModels, createVehicleModel, updateVehicleModel, deleteVehicleModel,
  VehicleModel,
} from '@/services/vehicle-model.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useCountry } from '@/context/CountryContext';
import styles from './page.module.css';

import { COMPATIBILITY_COUNTRIES, COUNTRY_LABELS, CompatibilityCountry } from '@/lib/compatibility-countries';
import { getCarBrands, CarBrand } from '@/services/car-brand.service';
import Autocomplete from '@/components/ui/Autocomplete';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';

const EMPTY = { brand: '', model: '', yearFrom: '', yearTo: '', country: '' as CompatibilityCountry | '' };
type ModalState = { mode: 'create'; form: typeof EMPTY } | { mode: 'edit'; form: typeof EMPTY; model: VehicleModel };

export default function VehiclesPage() {
  const { canManage, isAdmin } = usePermissions();
  const { country } = useCountry();
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<ModalState | null>(null);

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [brandSuggestions, setBrandSuggestions] = useState<CarBrand[]>([]);

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
    setModalError(null);
    const prefilledCountry = !isAdmin && country ? country as CompatibilityCountry : '';
    setModal({ mode: 'create', form: { ...EMPTY, country: prefilledCountry } });
  }

  async function handleCreate() {
    if (!modal || modal.mode !== 'create') return;
    setSaving(true);
    setModalError(null);
    const resolvedCountry = isAdmin ? modal.form.country : (country ?? modal.form.country);
    try {
      const created = await createVehicleModel({
        brand: modal.form.brand,
        model: modal.form.model,
        yearFrom: Number(modal.form.yearFrom),
        country: resolvedCountry as string,
      });
      setModels(prev => [...prev, created].sort((a, b) => a.brand.localeCompare(b.brand)));
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(vm: VehicleModel) {
    setModalError(null);
    setModal({ mode: 'edit', form: { brand: vm.brand, model: vm.model, yearFrom: String(vm.yearFrom), yearTo: vm.yearTo != null ? String(vm.yearTo) : '', country: vm.country as CompatibilityCountry }, model: vm });
  }

  async function handleEdit() {
    if (!modal || modal.mode !== 'edit') return;
    setSaving(true);
    setModalError(null);
    try {
      const updated = await updateVehicleModel(modal.model.id, {
        brand: modal.form.brand,
        model: modal.form.model,
        yearFrom: Number(modal.form.yearFrom),
        yearTo: Number(modal.form.yearTo),
        country: modal.form.country as string,
      });
      setModels(prev => prev.map(m => m.id === updated.id ? updated : m));
      setModal(null);
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

  function isCreateFormIncomplete() {
    const countryMissing = isAdmin && !modal?.form.country;
    return !modal?.form.brand || !modal?.form.model || !modal?.form.yearFrom || countryMissing;
  }

  const footer = modal ? (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setModal(null)} disabled={saving} />
      <Button
        label={saving ? 'Guardando...' : modal.mode === 'create' ? 'Crear' : 'Guardar'}
        color="primary"
        onClick={modal.mode === 'create' ? handleCreate : handleEdit}
        disabled={saving || (modal.mode === 'create' && isCreateFormIncomplete())}
      />
    </>
  ) : null;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Modelos de vehículos</h1>
        {canManage && <Button label="+ Nuevo modelo" onClick={openCreate} shadow />}
      </div>

      <div className={styles.controls}>
        <Search value={search} onChange={setSearch} placeholder="Buscar por marca o modelo..." />
        <Select
          value={countryFilter}
          onChange={v => setCountryFilter(v as CompatibilityCountry | '')}
          options={COMPATIBILITY_COUNTRIES.map(c => ({ value: c, label: COUNTRY_LABELS[c] }))}
          placeholder="Todos los países"
        />
      </div>

      <Table<VehicleModel>
        rows={visible}
        getKey={vm => vm.id}
        emptyMessage="No hay modelos registrados."
        columns={[
          { header: 'Marca', render: vm => vm.brand },
          { header: 'Modelo', render: vm => vm.model },
          { header: 'Año desde', render: vm => vm.yearFrom, className: styles.tdMeta },
          ...(isAdmin ? [{ header: 'País', render: (vm: VehicleModel) => vm.country, className: styles.tdMeta } as Column<VehicleModel>] : []),
          { header: '', render: vm => canManage ? (
            <>
              <Button label="Editar" variant="ghost" color="neutral" size="sm" onClick={() => openEdit(vm)} />
              <Button label="Eliminar" variant="ghost" color="danger" size="sm" onClick={() => handleDelete(vm.id)} />
            </>
          ) : null, className: styles.tdActions },
        ] as Column<VehicleModel>[]}
      />

      <Modal isOpen={modal !== null} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo modelo' : 'Editar modelo'} size="md" footer={footer}>
        {modal && (
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Marca
                <Autocomplete<CarBrand>
                  value={modal.form.brand}
                  onChange={v => setModal(prev => prev ? { ...prev, form: { ...prev.form, brand: v } } : prev)}
                  onSearch={q => getCarBrands({ search: q }).then(setBrandSuggestions)}
                  onSelect={b => setModal(prev => prev ? { ...prev, form: { ...prev.form, brand: b.name } } : prev)}
                  suggestions={brandSuggestions}
                  getLabel={b => b.name}
                  getKey={b => b.id}
                  placeholder="Escriba la marca para realizar la búsqueda..."
                />
              </label>
              <label className={styles.formLabel}>
                Modelo
                <input className={styles.formInput} value={modal.form.model} onChange={e => setModal(prev => prev ? { ...prev, form: { ...prev.form, model: e.target.value } } : prev)} />
              </label>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Año desde
                <input className={styles.formInput} type="number" value={modal.form.yearFrom} onChange={e => setModal(prev => prev ? { ...prev, form: { ...prev.form, yearFrom: e.target.value } } : prev)} placeholder="2013" />
              </label>
              {(isAdmin || modal.mode === 'edit') && (
                <label className={styles.formLabel}>
                  País
                  <Select
                    value={modal.form.country}
                    onChange={v => setModal(prev => prev ? { ...prev, form: { ...prev.form, country: v as CompatibilityCountry } } : prev)}
                    options={COMPATIBILITY_COUNTRIES.map(c => ({ value: c, label: COUNTRY_LABELS[c] }))}
                    placeholder="Seleccionar país"
                  />
                </label>
              )}
            </div>
            {modalError && <p className={styles.error}>{modalError}</p>}
          </div>
        )}
      </Modal>
    </main>
  );
}
