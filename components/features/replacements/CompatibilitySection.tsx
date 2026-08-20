'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import {
  Compatibility,
  addCompatibility,
  getCompatibilitiesByReplacement,
  removeCompatibility,
} from '@/services/compatibility.service';
import { VehicleBrand, VehicleModel, VehicleVersion, getBrands, getModels, getVersions } from '@/services/vehicle.service';
import styles from './CompatibilitySection.module.css';

interface Props {
  replacementId: string;
  title?: string;
  oemCode?: string | null;
  onCountChange?: (count: number) => void;
}

export default function CompatibilitySection({ replacementId, title = 'Compatibilidades', oemCode, onCountChange }: Props) {
  const [items, setItems] = useState<Compatibility[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [addBrand, setAddBrand] = useState<VehicleBrand | null>(null);
  const [addModels, setAddModels] = useState<VehicleModel[]>([]);
  const [addModel, setAddModel] = useState<VehicleModel | null>(null);
  const [addVersions, setAddVersions] = useState<VehicleVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getCompatibilitiesByReplacement(replacementId)
      .then(items => { setItems(items); onCountChange?.(items.length); })
      .catch(() => setLoadError('No se pudieron cargar las compatibilidades'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replacementId]);

  function openAdd() {
    setAddBrand(null);
    setAddModels([]);
    setAddModel(null);
    setAddVersions([]);
    setAddQuery('');
    setSaveError(null);
    setAddOpen(true);
    if (brands.length === 0) {
      getBrands().catch(() => { setSaveError('No se pudieron cargar las marcas'); return []; }).then(setBrands);
    }
  }

  function selectBrand(brand: VehicleBrand) {
    setAddBrand(brand);
    setAddModel(null);
    setAddVersions([]);
    setAddQuery('');
    setAddModels([]);
    getModels(brand.id).catch(() => { setSaveError('No se pudieron cargar los modelos'); return []; }).then(setAddModels);
  }

  function backToBrands() {
    setAddBrand(null);
    setAddModels([]);
    setAddModel(null);
    setAddVersions([]);
    setAddQuery('');
  }

  function selectModel(model: VehicleModel) {
    setAddModel(model);
    setAddQuery('');
    setAddVersions([]);
    getVersions(model.id).catch(() => { setSaveError('No se pudieron cargar las versiones'); return []; }).then(setAddVersions);
  }

  function backToModels() {
    setAddModel(null);
    setAddVersions([]);
    setAddQuery('');
  }

  async function confirmVersion(version: VehicleVersion | null) {
    if (!addModel) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await addCompatibility(replacementId, addModel.id, version?.id);
      const next = [...items, created];
      setItems(next);
      onCountChange?.(next.length);
      setAddOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    try {
      await removeCompatibility(id);
      const next = items.filter(c => c.id !== id);
      setItems(next);
      onCountChange?.(next.length);
    } catch {
      setLoadError('No se pudo eliminar la compatibilidad');
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{title}</h2>
            {oemCode && <span className={styles.oemChip}>{oemCode}</span>}
          </div>
          <p className={styles.meta}>{items.length} modelo{items.length === 1 ? '' : 's'} compatible{items.length === 1 ? '' : 's'}</p>
        </div>
        <Button label="Agregar modelo" size="sm" variant="secondary" icon="/icons/plus.svg" onClick={openAdd} />
      </div>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {addOpen && (
        <div className={styles.addRow}>
          {addModel ? (
            <>
              <div className={styles.addRowHead}>
                <button className={styles.backLink} onClick={backToModels}>‹ {addBrand?.name}</button>
                <span className={styles.addRowLabel}>{addModel.name}</span>
              </div>
              <button
                className={styles.modelListItem}
                onClick={() => confirmVersion(null)}
                disabled={saving}
              >
                Todas las versiones
              </button>
              <div className={styles.modelList}>
                {addVersions.map(version => (
                  <button
                    key={version.id}
                    className={styles.modelListItem}
                    onClick={() => confirmVersion(version)}
                    disabled={saving}
                  >
                    {version.name}
                    {version.availableYears.length > 0 && (
                      <span className={styles.modelListItemMeta}>{version.availableYears.join(', ')}</span>
                    )}
                  </button>
                ))}
                {addVersions.length === 0 && <p className={styles.empty}>Sin versiones registradas para este modelo</p>}
              </div>
            </>
          ) : addBrand ? (
            <>
              <div className={styles.addRowHead}>
                <button className={styles.backLink} onClick={backToBrands}>‹ Marcas</button>
                <span className={styles.addRowLabel}>{addBrand.name}</span>
              </div>
              <input
                className={styles.addSearchInput}
                placeholder="Buscar modelo..."
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
                autoFocus
              />
              <div className={styles.modelList}>
                {addModels
                  .filter(m => m.name.toLowerCase().includes(addQuery.toLowerCase()))
                  .map(model => (
                    <button
                      key={model.id}
                      className={styles.modelListItem}
                      onClick={() => selectModel(model)}
                    >
                      {model.name}
                    </button>
                  ))}
                {addModels.length === 0 && <p className={styles.empty}>Sin modelos para esta marca</p>}
              </div>
            </>
          ) : (
            <>
              <span className={styles.addRowLabel}>Elegí la marca del modelo compatible</span>
              <input
                className={styles.addSearchInput}
                placeholder="Buscar marca..."
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
                autoFocus
              />
              <div className={styles.brandGrid}>
                {brands
                  .filter(b => b.name.toLowerCase().includes(addQuery.toLowerCase()))
                  .map(brand => (
                    <button key={brand.id} className={styles.brandCard} onClick={() => selectBrand(brand)}>
                      <img
                        src={`/vehicle-logos/${brand.slug}.svg`}
                        alt=""
                        className={styles.brandLogo}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className={styles.brandName}>{brand.name}</span>
                    </button>
                  ))}
              </div>
            </>
          )}
          {saveError && <p className={styles.modalError}>{saveError}</p>}
        </div>
      )}

      {items.length === 0 && !loadError ? (
        <p className={styles.empty}>Sin compatibilidades registradas</p>
      ) : (
        <div className={styles.chipGrid}>
          {items.map(c => (
            <div key={c.id} className={styles.chip}>
              <div className={styles.chipText}>
                <span className={styles.chipModel}>{c.model.name}</span>
                <span className={styles.chipBrand}>
                  {c.model.brand.name}{c.version ? ` · ${c.version.name}` : ''}
                </span>
                {c.version && c.version.availableYears.length > 0 && (
                  <span className={styles.chipYears}>{c.version.availableYears.join(', ')}</span>
                )}
              </div>
              <button
                className={styles.chipRemove}
                onClick={() => handleRemove(c.id)}
                aria-label="Eliminar compatibilidad"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
