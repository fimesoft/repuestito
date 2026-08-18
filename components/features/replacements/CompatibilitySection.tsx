'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Autocomplete from '@/components/ui/Autocomplete';
import Button from '@/components/ui/Button';
import {
  Compatibility,
  addCompatibility,
  getCompatibilitiesByReplacement,
  removeCompatibility,
} from '@/services/compatibility.service';
import { VehicleModel, searchVehicleModels } from '@/services/vehicle-model.service';
import styles from './CompatibilitySection.module.css';

interface Props {
  replacementId: string;
}

export default function CompatibilitySection({ replacementId }: Props) {
  const [items, setItems] = useState<Compatibility[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<VehicleModel[]>([]);
  const [selected, setSelected] = useState<VehicleModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getCompatibilitiesByReplacement(replacementId)
      .then(setItems)
      .catch(() => setLoadError('No se pudieron cargar las compatibilidades'));
  }, [replacementId]);

  const handleSearch = useCallback(async (q: string) => {
    try {
      const results = await searchVehicleModels(q);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    }
  }, []);

  function handleSelect(model: VehicleModel) {
    setSelected(model);
    setQuery(`${model.brand.name} ${model.name}`);
    setSuggestions([]);
  }

  function openModal() {
    setQuery('');
    setSelected(null);
    setSuggestions([]);
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleAdd() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await addCompatibility(replacementId, selected.id);
      setItems(prev => [...prev, created]);
      setModalOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    try {
      await removeCompatibility(id);
      setItems(prev => prev.filter(c => c.id !== id));
    } catch {
      setLoadError('No se pudo eliminar la compatibilidad');
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Compatibilidades</h2>
        <Button label="Agregar modelo" size="sm" variant="outline" onClick={openModal} />
      </div>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {items.length === 0 && !loadError ? (
        <p className={styles.empty}>Sin compatibilidades registradas</p>
      ) : (
        <ul className={styles.list}>
          {items.map(c => (
            <li key={c.id} className={styles.row}>
              <div className={styles.modelLabel}>
                <span className={styles.modelName}>{c.model.name}</span>
                <span className={styles.brandName}>{c.model.brand.name}</span>
              </div>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(c.id)}
                aria-label="Eliminar compatibilidad"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Agregar modelo compatible"
        size="sm"
        footer={
          <Button
            label={saving ? 'Guardando...' : 'Agregar'}
            onClick={handleAdd}
            disabled={!selected || saving}
            fullWidth
          />
        }
      >
        <div className={styles.modalBody}>
          <Autocomplete<VehicleModel>
            value={query}
            onChange={v => { setQuery(v); setSelected(null); }}
            onSearch={handleSearch}
            onSelect={handleSelect}
            suggestions={suggestions}
            getLabel={m => `${m.brand.name} ${m.name}`}
            getKey={m => m.id}
            placeholder="Buscar modelo (ej: Corolla)"
            minChars={2}
          />
          {saveError && <p className={styles.modalError}>{saveError}</p>}
        </div>
      </Modal>
    </section>
  );
}
