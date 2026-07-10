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
import LocationSearch from '@/components/ui/LocationSearch/LocationSearch';
import styles from './page.module.css';

export default function StoresPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [branches, setBranches] = useState<Record<string, Branch[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState<UpdateTenantPayload>({});

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState<UpdateBranchPayload>({});

  const [addBranchTenantId, setAddBranchTenantId] = useState<string | null>(null);
  const [newBranchForm, setNewBranchForm] = useState<CreateBranchPayload>({ name: '' });

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function loadTenants() {
    const data = await getTenants();
    setTenants(data);
  }

  useEffect(() => { loadTenants(); }, []);

  async function toggleExpand(tenantId: string) {
    const next = new Set(expanded);
    if (next.has(tenantId)) {
      next.delete(tenantId);
    } else {
      next.add(tenantId);
      if (!branches[tenantId]) {
        const data = await getBranches(tenantId);
        setBranches(prev => ({ ...prev, [tenantId]: data }));
      }
    }
    setExpanded(next);
  }

  async function handleDeleteTenant(id: string) {
    if (!confirm('¿Eliminar este local y todas sus sucursales?')) return;
    try {
      await deleteTenant(id);
      setTenants(prev => prev.filter(t => t.id !== id));
      setBranches(prev => { const next = { ...prev }; delete next[id]; return next; });
      setExpanded(prev => { const next = new Set(prev); next.delete(id); return next; });
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
        <h1 className={styles.title}>Locales</h1>
        <Button label="+ Nuevo local" onClick={() => setWizardOpen(true)} shadow />
      </div>

      <ul className={styles.list}>
        {tenants.map(tenant => (
          <li key={tenant.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.info}>
                <span className={styles.name}>{tenant.businessName}</span>
                <span className={styles.meta}>{tenant.taxId} · {tenant.subdomain}</span>
              </div>
              <div className={styles.actions}>
                <span className={tenant.active ? styles.badgeActive : styles.badgeInactive}>
                  {tenant.active ? 'Activo' : 'Inactivo'}
                </span>
                <button className={styles.btnText} onClick={() => openEditTenant(tenant)}>Editar</button>
                <button className={styles.btnDanger} onClick={() => handleDeleteTenant(tenant.id)}>Eliminar</button>
                <button className={styles.btnExpand} onClick={() => toggleExpand(tenant.id)}>
                  {expanded.has(tenant.id) ? '▲' : '▼'} Sucursales
                </button>
              </div>
            </div>

            {expanded.has(tenant.id) && (
              <div className={styles.branches}>
                {(branches[tenant.id] ?? []).length === 0 ? (
                  <p className={styles.empty}>Sin sucursales</p>
                ) : (
                  <ul className={styles.branchList}>
                    {(branches[tenant.id] ?? []).map(branch => (
                      <li key={branch.id} className={styles.branchItem}>
                        <div className={styles.branchInfo}>
                          <span className={styles.branchName}>{branch.name}</span>
                          {branch.address && <span className={styles.branchMeta}>{branch.address}</span>}
                          {branch.phone && <span className={styles.branchMeta}>{branch.phone}</span>}
                        </div>
                        <div className={styles.branchActions}>
                          <button className={styles.btnText} onClick={() => openEditBranch(branch)}>Editar</button>
                          <button className={styles.btnDanger} onClick={() => handleDeleteBranch(tenant.id, branch.id)}>Eliminar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button className={styles.btnAddBranch} onClick={() => openAddBranch(tenant.id)}>
                  + Añadir sucursal
                </button>
              </div>
            )}
          </li>
        ))}

        {tenants.length === 0 && (
          <p className={styles.empty}>No hay locales registrados.</p>
        )}
      </ul>

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
              <input className={styles.formInput} value={tenantForm.subdomain ?? ''} onChange={e => setTenantForm(p => ({ ...p, subdomain: e.target.value }))} />
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
