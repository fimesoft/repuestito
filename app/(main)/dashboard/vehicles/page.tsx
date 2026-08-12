'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import {
  getBrands, createBrand, deleteBrand,
  getModels, createModel, deleteModel,
  getVersions, createVersion, deleteVersion,
  VehicleBrand, VehicleModel, VehicleVersion,
} from '@/services/vehicle.service';
import { usePermissions } from '@/hooks/usePermissions';
import Search from '@/components/ui/Search/Search';
import styles from './page.module.css';

type ModalView = 'models' | 'versions';

export default function VehiclesPage() {
  const { isAdmin } = usePermissions();

  // Brand grid
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);

  // Modal state
  const [activeBrand, setActiveBrand] = useState<VehicleBrand | null>(null);
  const [view, setView] = useState<ModalView>('models');
  const [activeModel, setActiveModel] = useState<VehicleModel | null>(null);

  const [models, setModels] = useState<VehicleModel[]>([]);
  const [versions, setVersions] = useState<VehicleVersion[]>([]);

  const [newModelName, setNewModelName] = useState('');
  const [newVersionName, setNewVersionName] = useState('');
  const [search, setSearch] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getBrands().then(setBrands); }, []);

  // Load models when brand modal opens
  useEffect(() => {
    if (!activeBrand) return;
    setModels([]);
    setVersions([]);
    setActiveModel(null);
    setView('models');
    getModels(activeBrand.id).then(setModels);
  }, [activeBrand]);

  // Load versions when model is selected
  useEffect(() => {
    if (!activeModel) return;
    setVersions([]);
    getVersions(activeModel.id).then(setVersions);
  }, [activeModel]);

  function openBrand(brand: VehicleBrand) {
    setError(null);
    setSearch('');
    setNewModelName('');
    setNewVersionName('');
    setActiveBrand(brand);
  }

  function closeModal() {
    setActiveBrand(null);
    setActiveModel(null);
    setView('models');
  }

  function drillIntoModel(model: VehicleModel) {
    setActiveModel(model);
    setSearch('');
    setNewVersionName('');
    setError(null);
    setView('versions');
  }

  function backToModels() {
    setView('models');
    setSearch('');
    setActiveModel(null);
    setVersions([]);
  }

  // ── Brand CRUD ──────────────────────────────────────────────────────
  async function handleAddBrand() {
    if (!newBrandName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const brand = await createBrand({ name: newBrandName.trim() });
      setBrands(prev => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBrandName('');
      setAddingBrand(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear marca');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBrand(brand: VehicleBrand) {
    if (!confirm(`¿Eliminar ${brand.name}? Se eliminarán todos sus modelos y versiones.`)) return;
    try {
      await deleteBrand(brand.id);
      setBrands(prev => prev.filter(b => b.id !== brand.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  // ── Model CRUD ──────────────────────────────────────────────────────
  async function handleAddModel() {
    if (!activeBrand || !newModelName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const model = await createModel({ brandId: activeBrand.id, name: newModelName.trim() });
      setModels(prev => [...prev, model].sort((a, b) => a.name.localeCompare(b.name)));
      setNewModelName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear modelo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteModel(model: VehicleModel) {
    if (!confirm(`¿Eliminar ${model.name}?`)) return;
    try {
      await deleteModel(model.id);
      setModels(prev => prev.filter(m => m.id !== model.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  // ── Version CRUD ─────────────────────────────────────────────────────
  async function handleAddVersion() {
    if (!activeModel || !newVersionName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const version = await createVersion({
        modelId: activeModel.id,
        countryId: 0,
        externalId: `manual-${Date.now()}`,
        name: newVersionName.trim(),
        availableYears: [],
      });
      setVersions(prev => [...prev, version].sort((a, b) => a.name.localeCompare(b.name)));
      setNewVersionName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear versión');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVersion(version: VehicleVersion) {
    if (!confirm(`¿Eliminar ${version.name}?`)) return;
    try {
      await deleteVersion(version.id);
      setVersions(prev => prev.filter(v => v.id !== version.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Parque automotor</h1>
        {isAdmin && (
          <Button label="+ Marca" onClick={() => setAddingBrand(true)} shadow />
        )}
      </div>

      {/* Add brand inline form */}
      {addingBrand && (
        <div className={styles.addForm} style={{ marginBottom: '1.5rem' }}>
          <input
            className={styles.addInput}
            placeholder="Nombre de la marca"
            value={newBrandName}
            onChange={e => setNewBrandName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBrand()}
            autoFocus
          />
          <Button label={saving ? '...' : 'Crear'} color="primary" onClick={handleAddBrand} disabled={saving} />
          <Button label="Cancelar" variant="outline" color="neutral" onClick={() => { setAddingBrand(false); setNewBrandName(''); }} />
          {error && <span className={styles.error}>{error}</span>}
        </div>
      )}

      <Search value={brandSearch} onChange={setBrandSearch} placeholder="Buscar marca..." width={360} />

      {/* Brand grid */}
      {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 ? (
        <p className={styles.empty}>Sin resultados.</p>
      ) : (
        <div className={styles.grid}>
          {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).map(brand => (
            <div key={brand.id} className={styles.brandCard} onClick={() => openBrand(brand)}>
              <img
                src={`/vehicle-logos/${brand.slug}.svg`}
                alt={brand.name}
                className={styles.brandLogo}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span className={styles.brandName}>{brand.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
            </div>
          ))}
        </div>
      )}

      {/* Brand modal */}
      <Modal
        isOpen={activeBrand !== null}
        onClose={closeModal}
        onBack={view === 'versions' ? backToModels : undefined}
        title={view === 'versions' ? (activeModel?.name ?? '') : (activeBrand?.name ?? '')}
        size="md"
      >
        {activeBrand && (
          <>
            <Search
              value={search}
              onChange={setSearch}
              placeholder={view === 'models' ? 'Buscar modelo...' : 'Buscar versión...'}
            />

            {/* Models view */}
            {view === 'models' && (
              <>
                <div className={styles.list}>
                  {models.filter(m => m.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <p className={styles.empty}>Sin resultados.</p>
                  )}
                  {models.filter(m => m.name.toLowerCase().includes(search.toLowerCase())).map(model => (
                    <div key={model.id} className={styles.listItem} onClick={() => drillIntoModel(model)}>
                      <span className={styles.listItemName}>{model.name}</span>
                      <span className={styles.listItemDrill}>{model.versionsCount} versiones ›</span>
                      {isAdmin && (
                        <div className={styles.listItemActions} onClick={e => e.stopPropagation()}>
                          <Button
                            label="✕"
                            variant="ghost"
                            color="danger"
                            size="sm"
                            onClick={() => handleDeleteModel(model)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className={styles.addForm}>
                    <input
                      className={styles.addInput}
                      placeholder="Nuevo modelo..."
                      value={newModelName}
                      onChange={e => setNewModelName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddModel()}
                    />
                    <Button label={saving ? '...' : '+ Agregar'} color="primary" size="sm" onClick={handleAddModel} disabled={saving} />
                  </div>
                )}
                {error && <p className={styles.error}>{error}</p>}
              </>
            )}

            {/* Versions view */}
            {view === 'versions' && activeModel && (
              <>
                <div className={styles.list}>
                  {versions.filter(v => v.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <p className={styles.empty}>Sin resultados.</p>
                  )}
                  {versions.filter(v => v.name.toLowerCase().includes(search.toLowerCase())).map(version => (
                    <div key={version.id} className={`${styles.listItem} ${styles.versionItem}`}>
                      <div className={styles.listItemName}>
                        <div>{version.name}</div>
                        {version.availableYears.length > 0 && (
                          <div className={styles.versionYears}>{version.availableYears.join(', ')}</div>
                        )}
                      </div>
                      {isAdmin && (
                        <div className={styles.listItemActions}>
                          <Button
                            label="✕"
                            variant="ghost"
                            color="danger"
                            size="sm"
                            onClick={() => handleDeleteVersion(version)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className={styles.addForm}>
                    <input
                      className={styles.addInput}
                      placeholder="Nueva versión..."
                      value={newVersionName}
                      onChange={e => setNewVersionName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddVersion()}
                    />
                    <Button label={saving ? '...' : '+ Agregar'} color="primary" size="sm" onClick={handleAddVersion} disabled={saving} />
                  </div>
                )}
                {error && <p className={styles.error}>{error}</p>}
              </>
            )}
          </>
        )}
      </Modal>
    </main>
  );
}
