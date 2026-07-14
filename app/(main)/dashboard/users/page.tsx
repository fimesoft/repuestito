'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { getUsers, inviteUser, updateUser, deleteUser, UserRecord, InviteUserPayload, UpdateUserPayload } from '@/services/user.service';
import { getTenants, Tenant } from '@/services/tenant.service';
import { getBranches, Branch } from '@/services/branch.service';
import styles from './page.module.css';

const ROLES = ['MODERATOR', 'SELLER'];

const EMPTY_CREATE: InviteUserPayload = { email: '', role: 'MODERATOR' };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [formBranches, setFormBranches] = useState<Branch[]>([]);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<InviteUserPayload>(EMPTY_CREATE);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserPayload>({});

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ email: string; devCode?: string } | null>(null);

  useEffect(() => {
    getUsers().then(setUsers);
    getTenants().then(setTenants);
  }, []);

  async function loadBranches(tenantId: string | undefined, setter: (b: Branch[]) => void) {
    if (!tenantId) { setter([]); return; }
    const data = await getBranches(tenantId);
    setter(data);
  }

  // ── Create ──────────────────────────────────────
  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setFormBranches([]);
    setModalError(null);
    setCreating(true);
  }

  function onCreateTenantChange(tenantId: string) {
    setCreateForm(p => ({ ...p, tenantId: tenantId || undefined, branchId: undefined }));
    loadBranches(tenantId || undefined, setFormBranches);
  }

  async function handleCreate() {
    setSaving(true);
    setModalError(null);
    try {
      const result = await inviteUser(createForm);
      await getUsers().then(setUsers);
      setInviteResult({ email: createForm.email, devCode: result.devCode });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al invitar');
    } finally {
      setSaving(false);
    }
  }

  function closeCreate() {
    setCreating(false);
    setInviteResult(null);
  }

  // ── Edit ────────────────────────────────────────
  function openEdit(user: UserRecord) {
    setEditingUser(user);
    setEditForm({ email: user.email, role: user.role, tenantId: user.tenantId, branchId: user.branchId, active: user.active });
    setModalError(null);
    if (user.tenantId) loadBranches(user.tenantId, setFormBranches);
    else setFormBranches([]);
  }

  function onEditTenantChange(tenantId: string) {
    setEditForm(p => ({ ...p, tenantId: tenantId || null, branchId: null }));
    loadBranches(tenantId || undefined, setFormBranches);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    setSaving(true);
    setModalError(null);
    try {
      const updated = await updateUser(editingUser.id, editForm);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setEditingUser(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  // ── Footers ─────────────────────────────────────
  const createFooter = inviteResult ? (
    <Button label="Cerrar" color="primary" onClick={closeCreate} />
  ) : (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={closeCreate} disabled={saving} />
      <Button label={saving ? 'Enviando...' : 'Enviar invitación'} color="primary" onClick={handleCreate} disabled={saving} />
    </>
  );

  const editFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setEditingUser(null)} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={handleSaveEdit} disabled={saving} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Usuarios</h1>
        <Button label="+ Nuevo usuario" onClick={openCreate} shadow />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Rol</th>
              <th>Local</th>
              <th>Sucursal</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td className={styles.tdEmail}>{user.email}</td>
                <td><span className={styles[`role${user.role}`]}>{user.role}</span></td>
                <td className={styles.tdMeta}>{tenants.find(t => t.id === user.tenantId)?.businessName ?? '—'}</td>
                <td className={styles.tdMeta}>{user.branchId ? user.branchId.slice(0, 8) + '…' : '—'}</td>
                <td>
                  <span className={user.active ? styles.badgeActive : styles.badgeInactive}>
                    {user.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className={styles.tdActions}>
                  <button className={styles.btnText} onClick={() => openEdit(user)}>Editar</button>
                  <button className={styles.btnDanger} onClick={() => handleDelete(user.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className={styles.empty}>No hay usuarios registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal isOpen={creating} onClose={closeCreate} title="Invitar usuario" size="md" footer={createFooter}>
        {inviteResult ? (
          <div className={styles.inviteSuccess}>
            <p className={styles.inviteSuccessMsg}>Invitación enviada a <strong>{inviteResult.email}</strong></p>
            {inviteResult.devCode && (
              <div className={styles.devCode}>
                <span className={styles.devCodeLabel}>Código (solo desarrollo)</span>
                <code className={styles.devCodeValue}>{inviteResult.devCode}</code>
                <p className={styles.devCodeHint}>El usuario debe ir a <strong>/app</strong> e ingresar este código junto a su nueva contraseña.</p>
              </div>
            )}
          </div>
        ) : (
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Email
            <input className={styles.formInput} type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} />
          </label>
          <label className={styles.formLabel}>
            Rol
            <select className={styles.formSelect} value={createForm.role ?? 'MODERATOR'} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Local
              <select className={styles.formSelect} value={createForm.tenantId ?? ''} onChange={e => onCreateTenantChange(e.target.value)}>
                <option value="">Sin asignar</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.businessName}</option>)}
              </select>
            </label>
            <label className={styles.formLabel}>
              Sucursal
              <select className={styles.formSelect} value={createForm.branchId ?? ''} onChange={e => setCreateForm(p => ({ ...p, branchId: e.target.value || undefined }))} disabled={!createForm.tenantId}>
                <option value="">Sin asignar</option>
                {formBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar usuario" size="md" footer={editFooter}>
        <div className={styles.form}>
          <label className={styles.formLabel}>
            Email
            <input className={styles.formInput} type="email" value={editForm.email ?? ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
          </label>
          <label className={styles.formLabel}>
            Nueva contraseña <span className={styles.optional}>(dejar vacío para no cambiar)</span>
            <input className={styles.formInput} type="password" value={editForm.password ?? ''} onChange={e => setEditForm(p => ({ ...p, password: e.target.value || undefined }))} />
          </label>
          <label className={styles.formLabel}>
            Rol
            <select className={styles.formSelect} value={editForm.role ?? ''} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} disabled={editingUser?.role === 'ADMIN'}>
              {editingUser?.role === 'ADMIN' && <option value="ADMIN">ADMIN</option>}
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Local
              <select className={styles.formSelect} value={editForm.tenantId ?? ''} onChange={e => onEditTenantChange(e.target.value)}>
                <option value="">Sin asignar</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.businessName}</option>)}
              </select>
            </label>
            <label className={styles.formLabel}>
              Sucursal
              <select className={styles.formSelect} value={editForm.branchId ?? ''} onChange={e => setEditForm(p => ({ ...p, branchId: e.target.value || null }))} disabled={!editForm.tenantId}>
                <option value="">Sin asignar</option>
                {formBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <label className={styles.formCheckbox}>
            <input type="checkbox" checked={editForm.active ?? true} onChange={e => setEditForm(p => ({ ...p, active: e.target.checked }))} />
            Activo
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>
    </main>
  );
}
