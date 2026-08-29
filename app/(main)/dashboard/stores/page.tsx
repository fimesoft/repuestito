'use client';

import { useEffect, useState } from 'react';
import TenantBranchWizard from '@/components/features/tenants/TenantBranchWizard';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import {
  getTenants, updateTenant, deleteTenant,
  Tenant, UpdateTenantPayload,
} from '@/services/tenant.service';
import {
  getBranches, createBranch, updateBranch, deleteBranch,
  Branch, CreateBranchPayload, UpdateBranchPayload,
} from '@/services/branch.service';
import LocationSearch from '@/components/ui/LocationSearch';
import { useCountry, getCountryName } from '@/context/CountryContext';
import { usePermissions } from '@/hooks/usePermissions';
import Badge from '@/components/ui/Badge';
import Loading from '@/components/ui/Loading';
import Card from '@/components/ui/Card';
import Dropdown from '@/components/ui/Dropdown';
import Accordion from '@/components/ui/Accordion';
import Avatar from '@/components/ui/Avatar';
import Search from '@/components/ui/Search';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import styles from './page.module.css';

export default function StoresPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [branches, setBranches] = useState<Record<string, Branch[]>>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState<UpdateTenantPayload>({});

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState<UpdateBranchPayload>({});

  const [addBranchTenantId, setAddBranchTenantId] = useState<string | null>(null);
  const [newBranchForm, setNewBranchForm] = useState<CreateBranchPayload>({ name: '' });

  const { country } = useCountry();
  const { canManage, isAdmin } = usePermissions();
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTenants() {
    setLoading(true);
    try {
      const data = await getTenants(country);
      setTenants(data);
      const branchMap: Record<string, Branch[]> = {};
      await Promise.all(data.map(async t => {
        branchMap[t.id] = await getBranches(t.id);
      }));
      setBranches(branchMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTenants(); }, [country]);

  async function handleDeleteTenant(id: string) {
    if (!confirm('¿Eliminar este local y todas sus sucursales?')) return;
    try {
      await deleteTenant(id);
      setTenants(prev => prev.filter(t => t.id !== id));
      setBranches(prev => { const next = { ...prev }; delete next[id]; return next; });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar el local');
    }
  }

  function openEditTenant(tenant: Tenant) {
    setEditingTenant(tenant);
    setTenantForm({ businessName: tenant.businessName, taxId: tenant.taxId, subdomain: tenant.subdomain, active: tenant.active });
    setModalError(null);
  }

  async function handleSaveTenant() {
    if (!editingTenant) return;
    setSaving(true);
    setModalError(null);
    try {
      const updated = await updateTenant(editingTenant.id, tenantForm);
      setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
      setEditingTenant(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function openEditBranch(branch: Branch) {
    setEditingBranch(branch);
    setBranchForm({ name: branch.name, address: branch.address ?? '', latitude: branch.latitude ?? undefined, longitude: branch.longitude ?? undefined, phone: branch.phone ?? '' });
    setModalError(null);
  }

  async function handleSaveBranch() {
    if (!editingBranch) return;
    setSaving(true);
    setModalError(null);
    try {
      const updated = await updateBranch(editingBranch.id, branchForm);
      const tid = editingBranch.tenantId;
      if (tid) setBranches(prev => ({ ...prev, [tid]: prev[tid].map(b => b.id === updated.id ? updated : b) }));
      setEditingBranch(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBranch(tenantId: string, branchId: string) {
    if (!confirm('¿Eliminar esta sucursal?')) return;
    try {
      await deleteBranch(branchId);
      setBranches(prev => ({ ...prev, [tenantId]: prev[tenantId].filter(b => b.id !== branchId) }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar la sucursal');
    }
  }

  function openAddBranch(tenantId: string) {
    setAddBranchTenantId(tenantId);
    setNewBranchForm({ name: '', tenantId });
    setModalError(null);
  }

  async function handleAddBranch() {
    if (!addBranchTenantId) return;
    setSaving(true);
    setModalError(null);
    try {
      const branch = await createBranch(newBranchForm);
      setBranches(prev => ({ ...prev, [addBranchTenantId]: [...(prev[addBranchTenantId] ?? []), branch] }));
      setAddBranchTenantId(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const filteredTenants = tenants.filter(t =>
    t.businessName.toLowerCase().includes(query.toLowerCase())
  );
  const totalSucursales = Object.values(branches).reduce((n, list) => n + list.length, 0);

  const editTenantFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setEditingTenant(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleSaveTenant} disabled={saving} />
    </>
  );

  const editBranchFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setEditingBranch(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleSaveBranch} disabled={saving} />
    </>
  );

  const addBranchFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setAddBranchTenantId(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleAddBranch} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Breadcrumbs items={[{ label: 'Locales' }]} />
          <MainTitle title="Locales" subtitle="Administración de sucursales y puntos de venta" />
        </div>
        {canManage && <Button label="+ Nuevo local" onClick={() => setWizardOpen(true)} shadow />}
      </div>

      <div className={styles.stats}>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Locales totales</span>
          <span className={styles.statValue}>{tenants.length}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Sucursales totales</span>
          <span className={styles.statValue}>{totalSucursales}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>Activos</span>
          <span className={styles.statValue}>{tenants.filter(t => t.active).length}</span>
        </Card>
      </div>

      <div className={styles.searchRow}>
        <Search value={query} onChange={setQuery} placeholder="Buscar local por nombre..." width="100%" />
      </div>

      {!loading && query && filteredTenants.length === 0 && (
        <p className={styles.empty}>No se encontraron locales para &quot;{query}&quot;.</p>
      )}

      {loading ? <Loading /> : <ul className={styles.list}>
        {filteredTenants.map((tenant, i) => (
          <li key={tenant.id}>
            <Accordion
              title={
                <div className={styles.info}>
                  <Avatar name={tenant.businessName} className={styles.storeAvatar} />
                  <div className={styles.infoText}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{tenant.businessName}</span>
                      <Badge label={tenant.active ? 'Activo' : 'Inactivo'} variant={tenant.active ? 'active' : 'inactive'} />
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaItem}>CUIT {tenant.taxId}</span>
                      <span className={styles.metaItem}>
                        <img src="/icons/link.svg" width={13} height={13} alt="" className={styles.metaIcon} />
                        {tenant.subdomain}.repuestito.com
                      </span>
                      {tenant.country && <span className={styles.metaItem}>{getCountryName(tenant.country)}</span>}
                      <span className={styles.metaItem}>
                        <img src="/icons/layers.svg" width={13} height={13} alt="" className={styles.metaIcon} />
                        {(branches[tenant.id] ?? []).length} sucursales
                      </span>
                    </div>
                  </div>
                </div>
              }
              actions={
                canManage ? (
                  <Dropdown items={[
                    { label: 'Editar', onClick: () => openEditTenant(tenant), icon: '/icons/edit.svg' },
                    { label: 'Eliminar', onClick: () => handleDeleteTenant(tenant.id), variant: 'danger', icon: '/icons/trash.svg' },
                  ]} />
                ) : undefined
              }
              defaultOpen={i === 0}
            >
              {(branches[tenant.id] ?? []).length === 0 ? (
                <p className={styles.empty}>Sin sucursales</p>
              ) : (
                <div className={styles.branchList}>
                  {(branches[tenant.id] ?? []).map(branch => (
                    <div key={branch.id} className={styles.branchItem}>
                      <div className={styles.branchInfo}>
                        <div className={styles.nameRow}>
                          <span
                            className={`${styles.statusDot} ${branch.active ? styles.statusDotActive : styles.statusDotInactive}`}
                            title={branch.active ? 'Activo' : 'Inactivo'}
                          />
                          <span className={styles.branchName}><strong>Sucursal:</strong> {branch.name}</span>
                        </div>
                        <div className={styles.metaRow}>
                          {branch.address && (
                            <span className={styles.metaItem}>
                              <img src="/icons/map-pin.svg" width={13} height={13} alt="" className={styles.metaIcon} />
                              {branch.address}
                            </span>
                          )}
                          {branch.phone && (
                            <span className={styles.metaItem}>
                              <img src="/icons/phone.svg" width={13} height={13} alt="" className={styles.metaIcon} />
                              {branch.phone}
                            </span>
                          )}
                          {branch.latitude && branch.longitude && <span className={styles.metaItem}>{branch.latitude.toFixed(4)}, {branch.longitude.toFixed(4)}</span>}
                        </div>
                      </div>
                      {canManage && (
                        <Dropdown items={[
                          { label: 'Editar', onClick: () => openEditBranch(branch), icon: '/icons/edit.svg' },
                          { label: 'Eliminar', onClick: () => handleDeleteBranch(tenant.id, branch.id), variant: 'danger', icon: '/icons/trash.svg' },
                        ]} />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canManage && (
                <div className={styles.addBranchRow}>
                  <Button label="Añadir sucursal" variant="secondary" size="sm" icon="/icons/plus.svg" onClick={() => openAddBranch(tenant.id)} />
                </div>
              )}
            </Accordion>
          </li>
        ))}

        {tenants.length === 0 && (
          <p className={styles.empty}>No hay locales registrados.</p>
        )}
      </ul>}

      <TenantBranchWizard
        isOpen={wizardOpen}
        onClose={async () => { setWizardOpen(false); await loadTenants(); }}
      />

      <Modal isOpen={!!editingTenant} onClose={() => setEditingTenant(null)} title="Editar local" size="md" footer={editTenantFooter}>
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Nombre del local
            <input className={styles.formInput} value={tenantForm.businessName ?? ''} onChange={e => setTenantForm(p => ({ ...p, businessName: e.target.value }))} />
          </label>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              CUIT / RUT / NIT
              <input className={styles.formInput} value={tenantForm.taxId ?? ''} onChange={e => setTenantForm(p => ({ ...p, taxId: e.target.value }))} />
            </label>
            <label className={styles.formLabel}>
              Subdominio
              <input className={styles.formInput} value={tenantForm.subdomain ?? ''} onChange={e => setTenantForm(p => ({ ...p, subdomain: e.target.value }))} disabled={!isAdmin} />
            </label>
          </div>
          <label className={styles.formCheckbox}>
            <input type="checkbox" checked={tenantForm.active ?? true} onChange={e => setTenantForm(p => ({ ...p, active: e.target.checked }))} />
            Activo
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>

      <Modal isOpen={!!editingBranch} onClose={() => setEditingBranch(null)} title="Editar sucursal" size="md" footer={editBranchFooter}>
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Nombre
            <input className={styles.formInput} value={branchForm.name ?? ''} onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))} />
          </label>
          <label className={styles.formLabel}>
            Ubicación
            <LocationSearch
              key={editingBranch?.id}
              initialValue={branchForm.address ?? ''}
              onSelect={(lat, lon, address) => setBranchForm(p => ({ ...p, address, latitude: lat, longitude: lon }))}
            />
          </label>
          <label className={styles.formLabel}>
            Teléfono
            <input className={styles.formInput} value={branchForm.phone ?? ''} onChange={e => setBranchForm(p => ({ ...p, phone: e.target.value }))} />
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>

      <Modal isOpen={!!addBranchTenantId} onClose={() => setAddBranchTenantId(null)} title="Nueva sucursal" size="md" footer={addBranchFooter}>
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Nombre
            <input className={styles.formInput} value={newBranchForm.name} onChange={e => setNewBranchForm(p => ({ ...p, name: e.target.value }))} required />
          </label>
          <label className={styles.formLabel}>
            Ubicación
            <LocationSearch
              onSelect={(lat, lon, address) => setNewBranchForm(p => ({ ...p, address, latitude: lat, longitude: lon }))}
            />
          </label>
          <label className={styles.formLabel}>
            Teléfono
            <input className={styles.formInput} value={newBranchForm.phone ?? ''} onChange={e => setNewBranchForm(p => ({ ...p, phone: e.target.value }))} />
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>
    </main>
  );
}
