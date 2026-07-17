'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { getReplacement, Replacement } from '@/services/replacement.service';
import {
  getCompatibilityByReplacement, addCompatibility, removeCompatibility,
  CompatibilityEntry,
} from '@/services/compatibility.service';
import { getVehicleModels, VehicleModel } from '@/services/vehicle-model.service';
import { COMPATIBILITY_COUNTRIES, CompatibilityCountry } from '@/lib/compatibility-countries';
import { usePermissions } from '@/hooks/usePermissions';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReplacementCompatibilityPage({ params }: PageProps) {
  const { canManage } = usePermissions();
  const [replacementId, setReplacementId] = useState('');
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [activeCountry, setActiveCountry] = useState<CompatibilityCountry>(COMPATIBILITY_COUNTRIES[0]);
  const [entries, setEntries] = useState<CompatibilityEntry[]>([]);

  const [adding, setAdding] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [modelResults, setModelResults] = useState<VehicleModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setReplacementId(id);
      getReplacement(id).then(setReplacement);
    });
  }, [params]);

  useEffect(() => {
    if (!replacementId) return;
    getCompatibilityByReplacement(activeCountry, replacementId).then(setEntries);
  }, [activeCountry, replacementId]);

  useEffect(() => {
    if (!modelSearch.trim()) { setModelResults([]); return; }
    const timer = setTimeout(() => {
      getVehicleModels({ brand: modelSearch, country: activeCountry }).then(setModelResults);
    }, 300);
    return () => clearTimeout(timer);
  }, [modelSearch]);

  async function handleAdd() {
    if (!selectedModel) return;
    setSaving(true);
    setModalError(null);
    try {
      const entry = await addCompatibility(activeCountry, {
        replacementId,
        vehicleModelId: selectedModel.id,
      });
      setEntries(prev => [...prev, entry]);
      setAdding(false);
      setSelectedModel(null);
      setModelSearch('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al agregar');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(entry: CompatibilityEntry) {
    if (!confirm('¿Eliminar esta compatibilidad?')) return;
    await removeCompatibility(activeCountry, entry.replacementId, entry.vehicleModelId);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
  }

  function openAdd() {
    setSelectedModel(null);
    setModelSearch('');
    setModelResults([]);
    setModalError(null);
    setAdding(true);
  }

  const addFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setAdding(false)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Agregar'} color="primary" onClick={handleAdd} disabled={saving || !selectedModel} />
    </>
  );

  return (
    <main className={styles.page}>
      <Link href="/dashboard/replacement" className={styles.back}>← Volver a repuestos</Link>
      <h1 className={styles.title}>Compatibilidades — {replacement?.name ?? '...'}</h1>

      <div className={styles.tabs}>
        {COMPATIBILITY_COUNTRIES.map(c => (
          <button
            key={c}
            className={`${styles.tab} ${activeCountry === c ? styles.tabActive : ''}`}
            onClick={() => { setActiveCountry(c); setModelSearch(''); setModelResults([]); setSelectedModel(null); }}
          >
            {c}
          </button>
        ))}
      </div>

      {canManage && (
        <div className={styles.tabHeader}>
          <Button label="+ Agregar modelo" onClick={openAdd} shadow />
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Año desde</th>
              <th>Año hasta</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td>{entry.vehicleModel.brand}</td>
                <td>{entry.vehicleModel.model}</td>
                <td className={styles.tdMeta}>{entry.vehicleModel.yearFrom}</td>
                <td className={styles.tdMeta}>{entry.vehicleModel.yearTo}</td>
                {canManage && (
                  <td className={styles.tdActions}>
                    <button className={styles.btnDanger} onClick={() => handleRemove(entry)}>Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className={styles.empty}>
                  Sin compatibilidades para {activeCountry}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Agregar modelo compatible" size="md" footer={addFooter}>
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Buscar modelo
            <input
              className={styles.formInput}
              placeholder="Ej: Toyota, Corolla..."
              value={modelSearch}
              onChange={e => { setModelSearch(e.target.value); setSelectedModel(null); }}
            />
          </label>

          {modelResults.length > 0 && !selectedModel && (
            <div className={styles.suggestion}>
              {modelResults.map(vm => (
                <div
                  key={vm.id}
                  className={styles.suggestionItem}
                  onClick={() => { setSelectedModel(vm); setModelResults([]); }}
                >
                  {vm.brand} {vm.model} ({vm.yearFrom}–{vm.yearTo})
                </div>
              ))}
            </div>
          )}

          {selectedModel && (
            <div className={styles.selectedModel}>
              ✓ {selectedModel.brand} {selectedModel.model} ({selectedModel.yearFrom}–{selectedModel.yearTo})
            </div>
          )}

          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>
    </main>
  );
}
