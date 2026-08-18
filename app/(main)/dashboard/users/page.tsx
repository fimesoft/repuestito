'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import { getUsers, inviteUser, updateUser, deleteUser, UserRecord, InviteUserPayload, UpdateUserPayload } from '@/services/user.service';
import { getTenants, Tenant } from '@/services/tenant.service';
import { getBranches, Branch } from '@/services/branch.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useCountry } from '@/context/CountryContext';
import styles from './page.module.css';
import Search from '@/components/ui/Search';
import Table, { Column } from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/shared/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import PageCount from '@/components/shared/PageCount';
import Paginator from '@/components/ui/Paginator';
import Loading from '@/components/ui/Loading';
import Dropdown from '@/components/ui/Dropdown';

const ROLES = ['MODERATOR', 'SELLER'];

const EMPTY_CREATE: InviteUserPayload = { email: '', role: 'MODERATOR' };

export default function UsersPage() {
  const { country } = useCountry();
  const { currentUser, isAdmin, canManage } = usePermissions();
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getTenants(country).then(setTenants);
  }, [country]);

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

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);

  const filteredUsers = (isAdmin ? users : users.filter(u => u.tenantId === currentUser?.tenantId))
    .filter(u => !debouncedSearch || u.email.toLowerCase().includes(debouncedSearch.toLowerCase()));

  const visibleUsers = filteredUsers.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredUsers.length / limit);

  useEffect(() => { setPage(1); }, [debouncedSearch, limit]);

  // ── Footers ─────────────────────────────────────
  const createFooter = inviteResult ? (
    <Button label="Cerrar" color="primary" onClick={closeCreate} />
  ) : (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={closeCreate} disabled={saving} />
      <Button label={saving ? 'Enviando...' : 'Enviar invitación'} color="primary" onClick={handleCreate} disabled={saving || !createForm.email || !createForm.tenantId} />
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
        {canManage && <Button label="+ Nuevo usuario" onClick={openCreate} shadow />}
      </div>

      <div className={styles.controls}>
        <Search value={search} onChange={setSearch} placeholder="Buscar por email..." />
      </div>
      <div className={styles.subControls}>
        <PageCount total={filteredUsers.length} limit={limit} onLimitChange={setLimit} />
      </div>

      {loading ? <Loading /> : <Table<UserRecord>
        rows={visibleUsers}
        getKey={u => u.id}
        emptyMessage={<EmptyState variant={debouncedSearch ? 'no-results' : 'empty'} />}
        columns={[
          { header: 'Email', render: u => u.email, className: styles.tdEmail },
          { header: 'Rol', render: u => {
              const ROLE_VARIANT: Record<string, BadgeVariant> = { GOD: 'admin', MODERATOR: 'moderator', SELLER: 'seller' };
              return <Badge label={u.role} variant={ROLE_VARIANT[u.role] ?? 'neutral'} />;
            } },
          { header: 'Local', render: u => tenants.find(t => t.id === u.tenantId)?.businessName ?? '—', className: styles.tdMeta },
          { header: 'Sucursal', render: u => u.branchId ? u.branchId.slice(0, 8) + '…' : '—', className: styles.tdMeta },
          { header: 'Estado', render: u => <Badge label={u.active ? 'Activo' : 'Inactivo'} variant={u.active ? 'active' : 'inactive'} /> },
          { header: '', render: u => canManage ? (
            <Dropdown items={[
              { label: 'Editar', onClick: () => openEdit(u), icon: '/icons/edit.svg' },
              { label: 'Eliminar', onClick: () => handleDelete(u.id), variant: 'danger', icon: '/icons/trash.svg' },
            ]} />
          ) : null, className: styles.tdActions },
        ] as Column<UserRecord>[]}
      />}

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
            <Select value={createForm.role ?? 'MODERATOR'} onChange={v => setCreateForm(p => ({ ...p, role: v }))} options={ROLES.map(r => ({ value: r, label: r }))} />
          </label>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Local
              <Select value={createForm.tenantId ?? ''} onChange={onCreateTenantChange} options={tenants.map(t => ({ value: t.id, label: t.businessName }))} placeholder="Sin asignar" />
            </label>
            <label className={styles.formLabel}>
              Sucursal
              <Select value={createForm.branchId ?? ''} onChange={v => setCreateForm(p => ({ ...p, branchId: v || undefined }))} options={formBranches.map(b => ({ value: b.id, label: b.name }))} placeholder="Sin asignar" disabled={!createForm.tenantId} />
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
            <Select
              value={editForm.role ?? ''}
              onChange={v => setEditForm(p => ({ ...p, role: v }))}
              options={[
                ...(editingUser?.role === 'GOD' ? [{ value: 'GOD', label: 'GOD' }] : []),
                ...ROLES.map(r => ({ value: r, label: r })),
              ]}
              disabled={editingUser?.role === 'GOD'}
            />
          </label>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Local
              <Select value={editForm.tenantId ?? ''} onChange={onEditTenantChange} options={tenants.map(t => ({ value: t.id, label: t.businessName }))} placeholder="Sin asignar" />
            </label>
            <label className={styles.formLabel}>
              Sucursal
              <Select value={editForm.branchId ?? ''} onChange={v => setEditForm(p => ({ ...p, branchId: v || null }))} options={formBranches.map(b => ({ value: b.id, label: b.name }))} placeholder="Sin asignar" disabled={!editForm.tenantId} />
            </label>
          </div>
          <label className={styles.formCheckbox}>
            <input type="checkbox" checked={editForm.active ?? true} onChange={e => setEditForm(p => ({ ...p, active: e.target.checked }))} />
            Activo
          </label>
          {modalError && <p className={styles.error}>{modalError}</p>}
        </div>
      </Modal>

      {totalPages > 1 && (
        <Paginator currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </main>
  );
}
