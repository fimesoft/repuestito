'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import ImageUpload from '@/components/ui/ImageUpload';
import Table, { Column } from '@/components/ui/Table';
import Filters from '@/components/shared/Filters';
import Select from '@/components/ui/Select';
import ViewToggle from '@/components/ui/ViewToggle';
import ChipRail from '@/components/ui/ChipRail';
import Toggle from '@/components/ui/Toggle';
import Badge, { BADGE_ACCENT_VAR, BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/shared/EmptyState';
import PageCount from '@/components/shared/PageCount';
import Loading from '@/components/ui/Loading';
import Dropdown from '@/components/ui/Dropdown';
import Tooltip from '@/components/ui/Tooltip';
import ReplacementCard from '@/components/features/replacements/ReplacementCard';
import ProductImage from '@/components/shared/ProductImage';
import CatalogPicker, { CatalogOption } from '@/components/shared/CatalogPicker';

import {
  getReplacements, createReplacement, updateReplacement, deleteReplacement,
  getGlobalBySku, Replacement, CreateReplacementPayload, UpdateReplacementPayload, GlobalReplacementInfo,
} from '@/services/replacement.service';
import { getTenants, Tenant } from '@/services/tenant.service';
import { getBranches, Branch } from '@/services/branch.service';
import { getBrands, createBrand } from '@/services/brands.service';
import { getProductTypes, createProductType, ProductType } from '@/services/product-types.service';
import { uploadImage } from '@/services/upload.service';

import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import { useStockThresholds } from '@/hooks/useStockThresholds';
import { useCountry } from '@/context/CountryContext';

import { getStockLevel, StockThresholds } from '@/constants/replacement';
import { formatDateTime } from '@/lib/date';
import styles from './page.module.css';
import Label from '@/components/ui/Label';

const EMPTY: Omit<CreateReplacementPayload, 'countryCode'> = {
  name: '', brandId: 0, price: 0, tenantId: '',
};

interface EditFormState extends UpdateReplacementPayload {
  tenantId: string;
  branchId?: string;
}

const EMPTY_EDIT: EditFormState = { price: 0, stock: 0, active: true, tenantId: '' };

const DEFAULT_LIMIT = 10;

const STOCK_LEVEL_HINT: Record<'low' | 'normal' | 'full', (thresholds: StockThresholds) => string> = {
  low: t => `Stock bajo: ${t.lowStockMax} unidades o menos`,
  normal: t => `Stock normal: entre ${t.lowStockMax + 1} y ${t.normalStockMax} unidades`,
  full: t => `Stock completo: más de ${t.normalStockMax} unidades`,
};

export default function ReplacementDashboardPage() {
  const router = useRouter();
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [formBranches, setFormBranches] = useState<Branch[]>([]);

  const { country } = useCountry();
  const { currentUser, isAdmin, canManage } = usePermissions();
  const stockThresholds = useStockThresholds();
  const visibleTenants = isAdmin ? tenants : tenants.filter(t => t.id === currentUser?.tenantId);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 600);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<CreateReplacementPayload, 'countryCode'>>(EMPTY);
  const [priceInput, setPriceInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [brand, setBrand] = useState<CatalogOption | null>(null);
  const [productType, setProductType] = useState<CatalogOption | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [skuMatch, setSkuMatch] = useState<GlobalReplacementInfo | null>(null);
  const [useSkuMatch, setUseSkuMatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingReplacement, setEditingReplacement] = useState<Replacement | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT);
  const [editPriceInput, setEditPriceInput] = useState('');
  const [editCostInput, setEditCostInput] = useState('');
  const [editBranches, setEditBranches] = useState<Branch[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editUploadedUrl, setEditUploadedUrl] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoadError(false);
    setLoading(true);
    getReplacements({
      country,
      page,
      limit,
      search: debouncedSearch,
      from: from || undefined,
      to: to || undefined,
      active: activeFilter ? activeFilter === 'true' : undefined,
      productTypeId: typeFilter ? Number(typeFilter) : undefined,
    })
      .then(r => {
        setReplacements(r.data);
        setTotalPages(r.totalPages);
        setTotal(r.total);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [country, page, debouncedSearch, limit, from, to, activeFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [country, debouncedSearch, limit, from, to, activeFilter, typeFilter]);

  useEffect(() => {
    getTenants(country).then(setTenants);
  }, [country]);

  useEffect(() => {
    getProductTypes({ isActive: true, limit: 100 }).then(r => setProductTypes(r.data));
  }, []);

  const searchBrands = useCallback(
    (query: string) =>
      getBrands({ search: query, countryCode: country ?? undefined, limit: 10 })
        .then(r => r.data.map(b => ({ id: b.id, name: b.name }))),
    [country],
  );

  const createBrandOption = useCallback(
    async (name: string) => {
      if (!country) throw new Error('Selecciona un país para crear la marca');
      const created = await createBrand({ name, countryCode: country });
      return { id: created.id, name: created.name };
    },
    [country],
  );

  const searchProductTypes = useCallback(
    (query: string) =>
      getProductTypes({ search: query, isActive: true, limit: 10 })
        .then(r => r.data.map(t => ({ id: t.id, name: t.name }))),
    [],
  );

  const createProductTypeOption = useCallback(
    (name: string) => createProductType(name).then(t => ({ id: t.id, name: t.name })),
    [],
  );

  function set(field: Partial<CreateReplacementPayload>) {
    setForm(p => ({ ...p, ...field }));
  }

  function setEdit(field: Partial<EditFormState>) {
    setEditForm(p => ({ ...p, ...field }));
  }

  async function onTenantChange(tenantId: string) {
    setForm(({ branchId: _b, latitude: _lat, longitude: _lng, ...rest }) => ({ ...rest, tenantId, branchId: '' }));
    if (!tenantId) { setFormBranches([]); return; }
    const data = await getBranches(tenantId);
    setFormBranches(data);
  }

  async function openCreate() {
    const tenantId = !isAdmin && currentUser?.tenantId ? currentUser.tenantId : '';
    setForm({ ...EMPTY, tenantId });
    setPriceInput('');
    setCostInput('');
    setBrand(null);
    setProductType(null);
    setImageFile(null);
    setUploadedUrl(null);
    setSkuMatch(null);
    setUseSkuMatch(false);
    setFormBranches([]);
    setFormError(null);
    setCreating(true);
    if (tenantId) {
      const branches = await getBranches(tenantId);
      setFormBranches(branches);
      if (branches.length === 1) {
        const b = branches[0];
        set({
          branchId: b.id,
          ...(b.latitude != null && b.longitude != null && { latitude: b.latitude, longitude: b.longitude }),
        });
      }
    }
  }

  async function openEdit(r: Replacement) {
    setEditForm({ price: r.price, cost: r.cost != null ? Number(r.cost) : null, stock: r.stock, active: r.active ?? true, tenantId: r.tenantId, branchId: r.branchId ?? '' });
    setEditPriceInput(String(r.price));
    setEditCostInput(r.cost != null ? String(r.cost) : '');
    setEditBranches([]);
    setEditError(null);
    setEditImageFile(null);
    setEditUploadedUrl(null);
    if (r.tenantId) {
      const data = await getBranches(r.tenantId);
      setEditBranches(data);
    }
    setEditingReplacement(r);
  }

  async function onEditTenantChange(tenantId: string) {
    setEditForm(({ branchId: _b, latitude: _lat, longitude: _lng, ...rest }) => ({ ...rest, tenantId, branchId: '' }));
    if (!tenantId) { setEditBranches([]); return; }
    const data = await getBranches(tenantId);
    setEditBranches(data);
  }

  async function handleUpdate() {
    if (!editingReplacement) return;
    setSaving(true);
    setEditError(null);
    try {
      const { tenantId: _t, branchId, ...payload } = editForm;
      // La imagen nueva se sube recién ahora; la URL se guarda para no volver a subirla si el guardado falla y se reintenta.
      let imageUrl = editUploadedUrl;
      if (editImageFile && !imageUrl) {
        imageUrl = (await uploadImage(editImageFile)).url;
        setEditUploadedUrl(imageUrl);
      }
      const updated = await updateReplacement(editingReplacement.id, {
        ...payload,
        branchId: branchId || undefined,
        ...(imageUrl ? { imageUrl } : {}),
      });
      setReplacements(prev => prev.map(r => r.id === updated.id ? updated : r));
      setEditingReplacement(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  function onSkuChange(value: string) {
    set({ sku: value.toUpperCase().replace(/[^A-Z0-9]/g, '') });
    setSkuMatch(null);
    setUseSkuMatch(false);
  }

  async function onSkuBlur() {
    if (!form.sku || !country) return;
    try {
      setSkuMatch(await getGlobalBySku(form.sku, country));
    } catch {
      setSkuMatch(null);
    }
  }

  /** Rellena y bloquea nombre, tipo, marca e imagen con el producto que ya existe en el catálogo. */
  function applySkuMatch() {
    if (!skuMatch) return;
    set({ name: skuMatch.name });
    setBrand({ id: skuMatch.brand.id, name: skuMatch.brand.name });
    if (skuMatch.productType) setProductType({ id: skuMatch.productType.id, name: skuMatch.productType.name });
    setImageFile(null);
    setUploadedUrl(null);
    setUseSkuMatch(true);
  }

  function onImageChange(file: File | null) {
    setImageFile(file);
    setUploadedUrl(null);
  }

  function onEditImageChange(file: File | null) {
    setEditImageFile(file);
    setEditUploadedUrl(null);
  }

  async function handleCreate() {
    if (!form.tenantId) { setFormError('Selecciona un local'); return; }
    if (!country) { setFormError('Selecciona un país'); return; }
    if (!brand || !productType) { setFormError('Selecciona el tipo y la marca'); return; }
    setSaving(true);
    setFormError(null);
    try {
      // La imagen se sube recién ahora (no al elegirla) y solo si el producto es nuevo en el catálogo.
      // Se guarda la URL subida para que un reintento tras un error del alta no vuelva a subirla.
      let imageUrl = useSkuMatch ? null : uploadedUrl;
      if (!useSkuMatch && imageFile && !imageUrl) {
        imageUrl = (await uploadImage(imageFile)).url;
        setUploadedUrl(imageUrl);
      }
      const payload: CreateReplacementPayload = {
        ...form,
        brandId: brand.id,
        productTypeId: productType.id,
        countryCode: country,
        ...(imageUrl ? { imageUrl } : {}),
        ...(form.branchId ? { branchId: form.branchId } : { branchId: undefined }),
      };
      const created = await createReplacement(payload);
      setReplacements(prev => [created, ...prev]);
      setCreating(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  function handleActiveToggle(value: boolean) {
    if (!value) {
      setShowDeactivateConfirm(true);
    } else {
      setEdit({ active: true });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await deleteReplacement(id);
      setReplacements(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const skuPendingDecision = !!skuMatch && !useSkuMatch;
  const hasCost = typeof form.cost === 'number' && Number.isFinite(form.cost);
  const canCreate = !!form.name && !!brand && !!productType && form.price > 0 && hasCost && !!form.tenantId && !skuPendingDecision;
  const modalOpen = creating || !!editingReplacement;
  const modalTitle = creating ? 'Nuevo producto' : 'Editar producto';
  const modalClose = creating ? () => setCreating(false) : () => setEditingReplacement(null);
  const modalSave = creating ? handleCreate : handleUpdate;
  const modalCanDisable = creating ? (saving || !canCreate) : saving;

  const hasFilters = Boolean(search || from || to || activeFilter || typeFilter);

  const listEmptyMessage = loadError ? (
    <EmptyState variant="error" />
  ) : (
    <EmptyState
      variant={hasFilters ? 'no-results' : 'empty'}
      title={hasFilters ? 'Sin productos para tu búsqueda' : 'No hay productos registrados'}
      description={hasFilters
        ? 'No encontramos productos que coincidan con tu búsqueda o filtros. Probá con otros términos.'
        : 'Aún no tienes productos registrados. Cuando ingresen, aparecerán aquí.'}
    />
  );

  const modalFooter = (
    <>
      <Button label="Cancelar" variant="outline" color="neutral" onClick={modalClose} disabled={saving} />
      <Button label={saving ? 'Guardando...' : 'Guardar'} color="primary" onClick={modalSave} disabled={modalCanDisable} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Breadcrumbs items={[{ label: 'Productos' }]} />
          <MainTitle title="Productos" subtitle="Catálogo de productos" />
        </div>
        {canManage && (
          <div className={styles.createAction}>
            <Button label="+ Nuevo producto" onClick={openCreate} shadow />
          </div>
        )}
      </div>

      <Filters
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre de producto...' }}
        dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}
        selects={[
          {
            label: 'Estado',
            value: activeFilter,
            onChange: setActiveFilter,
            placeholder: 'Todos',
            options: [{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }],
          },
        ]}
      >
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </Filters>
      {productTypes.length > 0 && (
        <ChipRail
          ariaLabel="Filtrar por tipo de producto"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ value: '', label: 'Todos' }, ...productTypes.map(t => ({ value: String(t.id), label: t.name }))]}
        />
      )}
      <div className={styles.subControls}>
        <PageCount total={total} limit={limit} onLimitChange={setLimit} />
      </div>
      {loading ? (
        <Loading variant="orbit" />
      ) : viewMode === 'table' ? (
        <Table<Replacement>
          rows={replacements}
          getKey={r => r.id}
          emptyMessage={listEmptyMessage}
          onRowClick={r => router.push(`/dashboard/replacement/${r.id}/show`)}
          columns={[
            { header: 'Producto', render: r => {
              const label = `${r.globalReplacement?.name ?? 'Producto'} - ${r.globalReplacement?.brand?.name ?? ''}`;
              return <ProductImage src={r.globalReplacement?.imageUrl} alt={label} title={label} width={40} height={40} className={styles.img} />;
            }, className: styles.tdImg },
            { header: 'Nombre / Marca', render: r => (
              <div className={styles.nameCell}>
                <span className={styles.namePrimary}>{r.globalReplacement?.name}</span>
                <span className={styles.nameSecondary}>{r.globalReplacement?.brand?.name}</span>
              </div>
            ), className: styles.tdName },
            { header: 'Tipo', render: r => r.globalReplacement?.productType?.name ?? '—', className: styles.tdMeta },
            { header: 'Precio', render: r => `$${Number(r.price).toFixed(2)}`, className: styles.tdPrice },
            ...(isAdmin ? [{ header: 'País', render: (r: Replacement) => r.globalReplacement?.countryCode, className: styles.tdMeta } as Column<Replacement>] : []),
            { header: 'Stock', render: r => {
              const STOCK_VARIANT: Record<string, BadgeVariant> = {
                low: 'stockLow',
                normal: 'stockNormal',
                full: 'stockFull',
              };
              const level = getStockLevel(r.stock, stockThresholds);
              const variant = STOCK_VARIANT[level];
              return (
                <Tooltip content={STOCK_LEVEL_HINT[level](stockThresholds)} color={BADGE_ACCENT_VAR[variant]}>
                  <Badge label={`${r.stock} u.`} variant={variant} />
                </Tooltip>
              );
            }},
            { header: 'Sucursal', render: r => r.branch?.name ?? '—', className: styles.tdMeta },
            { header: 'Fecha', render: r => formatDateTime(r.createdAt), className: styles.tdMeta },
            { header: 'Estado', render: r => <Badge label={r.active !== false ? 'Activo' : 'Inactivo'} variant={r.active !== false ? 'active' : 'neutral'} /> },
            { header: '', render: r => (
              <div onClick={e => e.stopPropagation()}>
                <Dropdown items={[
                  { label: 'Ver', onClick: () => router.push(`/dashboard/replacement/${r.id}/show`), icon: '/icons/eye.svg' },
                  ...(canManage ? [
                    { label: 'Editar', onClick: () => openEdit(r), icon: '/icons/edit.svg' },
                    { label: 'Eliminar', onClick: () => handleDelete(r.id), variant: 'danger' as const, icon: '/icons/trash.svg' },
                  ] : []),
                ]} />
              </div>
            ), className: styles.tdActions },
          ]}
        />
      ) : (
        <div className={styles.grid}>
          {replacements.map((r, i) => {
            const level = getStockLevel(r.stock, stockThresholds);
            return (
              <ReplacementCard
                key={r.id}
                priority={i < 4}
                href={`/dashboard/replacement/${r.id}/show`}
                image={r.globalReplacement?.imageUrl ?? null}
                brand={r.globalReplacement?.brand?.name ?? ''}
                name={r.globalReplacement?.name ?? ''}
                sku={r.globalReplacement?.sku}
                price={Number(r.price)}
                stock={r.stock}
                stockLevel={level}
                stockHint={STOCK_LEVEL_HINT[level](stockThresholds)}
                active={r.active !== false}
                onEdit={canManage ? () => openEdit(r) : undefined}
              />
            );
          })}
          {replacements.length === 0 && listEmptyMessage}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.paginationWrapper}>
          <button className={styles.pageBtn} onClick={() => setPage(p => p - 1)} disabled={page === 1}>←</button>
          <span className={styles.pageInfo}>{page} / {totalPages}</span>
          <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>→</button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={modalClose} title={modalTitle} size="lg" footer={modalFooter}>
        <div className={styles.form}>
          {creating ? (
            <>
              {useSkuMatch ? (
                skuMatch?.imageUrl && (
                  <div className={styles.label}>
                    Imagen del catálogo
                    <Image src={skuMatch.imageUrl} alt={skuMatch.name} width={120} height={120} className={styles.img} />
                  </div>
                )
              ) : (
                <div className={styles.label}>
                  Imagen <span className={styles.optional}>(opcional)</span>
                  <ImageUpload onChange={onImageChange} />
                </div>
              )}

              {skuMatch && (
                <div className={styles.notice}>
                  <p>
                    Este SKU ya existe en el catálogo: <strong>{skuMatch.name}</strong>
                    {skuMatch.brand?.name ? ` — ${skuMatch.brand.name}` : ''}
                    {skuMatch.productType?.name ? ` (${skuMatch.productType.name})` : ''}.
                    {useSkuMatch ? ' Se usará ese producto.' : ' Usa ese producto o cambia el SKU.'}
                  </p>
                  {!useSkuMatch && <Button label="Usar este producto" size="sm" onClick={applySkuMatch} />}
                </div>
              )}

              <div className={styles.row}>
                <Label text="Nombre">
                  {useSkuMatch
                    ? <p className={styles.readOnly}>{form.name}</p>
                    : <input className={styles.input} value={form.name} onChange={e => set({ name: e.target.value })} required />}
                </Label>
                <Label text="Tipo">
                  {useSkuMatch
                    ? <p className={styles.readOnly}>{productType?.name}</p>
                    : <CatalogPicker entity="tipo" value={productType} onChange={setProductType} search={searchProductTypes} create={createProductTypeOption} placeholder="Buscar o crear tipo..." />}
                </Label>
              </div>

              <Label text="Marca">
                {useSkuMatch
                  ? <p className={styles.readOnly}>{brand?.name}</p>
                  : <CatalogPicker entity="marca" feminine value={brand} onChange={setBrand} search={searchBrands} create={createBrandOption} placeholder="Buscar o crear marca..." />}
              </Label>

              <div className={styles.row}>
                <Label text="Precio">
                  <input className={styles.input} type="text" inputMode="decimal" value={priceInput} onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) { setPriceInput(v); set({ price: parseFloat(v) || 0 }); } }} placeholder="0.00" required />
                </Label>
                <Label text="Costo">
                  <input className={styles.input} type="text" inputMode="decimal" value={costInput} onChange={e => { const v = e.target.value; if (/^\d*\.?\d{0,2}$/.test(v)) { setCostInput(v); set({ cost: v === '' ? undefined : parseFloat(v) }); } }} placeholder="0.00" required />
                </Label>
              </div>

              <div className={styles.row}>
                <Label text="Stock">
                  <input className={styles.input} type="text" inputMode="numeric" value={form.stock ?? ''} onChange={e => { if (/^\d*$/.test(e.target.value)) set({ stock: Number(e.target.value) }); }} placeholder="0" />
                </Label>
                <Label text={<>SKU <span className={styles.optional}>(opcional)</span></>}>
                  <input className={styles.input} value={form.sku ?? ''} onChange={e => onSkuChange(e.target.value)} onBlur={onSkuBlur} maxLength={64} placeholder="ej. 15400PLMA02" />
                </Label>
              </div>

              <div className={styles.row}>
                <Label text="Local">
                  <Select value={form.tenantId} onChange={onTenantChange} options={visibleTenants.map(t => ({ value: t.id, label: t.businessName }))} placeholder="Seleccionar local" disabled={!isAdmin} required />
                </Label>
                <Label text={<>Sucursal <span className={styles.optional}>(opcional)</span></>}>
                  <Select value={form.branchId ?? ''} onChange={v => { const branch = formBranches.find(b => b.id === v); set({ branchId: v, ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }) }); }} options={formBranches.map(b => ({ value: b.id, label: b.name }))} placeholder="Sin asignar" disabled={!form.tenantId} />
                </Label>
              </div>

              {formError && <p className={styles.error}>{formError}</p>}
            </>
          ) : (
            <>
              {editingReplacement && (
                <div className={styles.label}>
                  Imagen {!editingReplacement.globalReplacement?.imageUrl && <span className={styles.optional}>(no disponible: agrega una)</span>}
                  <ImageUpload key={editingReplacement.id} initialUrl={editingReplacement.globalReplacement?.imageUrl ?? undefined} onChange={onEditImageChange} />
                </div>
              )}

              {editingReplacement && (
                <div className={styles.row}>
                  <div className={styles.label}>
                    Nombre
                    <p className={styles.readOnly}>{editingReplacement.globalReplacement?.name}</p>
                  </div>
                  <div className={styles.label}>
                    Marca
                    <p className={styles.readOnly}>{editingReplacement.globalReplacement?.brand?.name}</p>
                  </div>
                </div>
              )}

              {editingReplacement && (
                <div className={styles.row}>
                  <div className={styles.label}>
                    Tipo
                    <p className={styles.readOnly}>{editingReplacement.globalReplacement?.productType?.name ?? '—'}</p>
                  </div>
                  <div className={styles.label}>
                    SKU
                    <p className={styles.readOnly}>{editingReplacement.globalReplacement?.sku ?? '—'}</p>
                  </div>
                </div>
              )}

              <div className={styles.row}>
                <Label text="Precio">
                  <input className={styles.input} type="text" inputMode="decimal" value={editPriceInput} onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) { setEditPriceInput(v); setEdit({ price: parseFloat(v) || 0 }); } }} placeholder="0.00" required />
                </Label>
                <Label text={<>Costo <span className={styles.optional}>(opcional)</span></>}>
                  <input className={styles.input} type="text" inputMode="decimal" value={editCostInput} onChange={e => { const v = e.target.value; if (/^\d*\.?\d{0,2}$/.test(v)) { setEditCostInput(v); setEdit({ cost: v === '' ? null : parseFloat(v) }); } }} placeholder="0.00" />
                </Label>
              </div>

              <div className={styles.row}>
                <Label text="Stock">
                  <input className={styles.input} type="text" inputMode="numeric" value={editForm.stock ?? ''} onChange={e => { if (/^\d*$/.test(e.target.value)) setEdit({ stock: Number(e.target.value) }); }} placeholder="0" />
                </Label>
              </div>

              <div className={styles.row}>
                <Label text="Local">
                  <Select value={editForm.tenantId} onChange={onEditTenantChange} options={tenants.map(t => ({ value: t.id, label: t.businessName }))} placeholder="Seleccionar local" required />
                </Label>
                <Label text={<>Sucursal <span className={styles.optional}>(opcional)</span></>}>
                  <Select value={editForm.branchId ?? ''} onChange={v => { const branch = editBranches.find(b => b.id === v); setEdit({ branchId: v, ...(branch?.latitude != null && branch?.longitude != null && { latitude: branch.latitude, longitude: branch.longitude }) }); }} options={editBranches.map(b => ({ value: b.id, label: b.name }))} placeholder="Sin asignar" disabled={!editForm.tenantId} />
                </Label>
              </div>

              <Toggle
                checked={editForm.active ?? true}
                onChange={handleActiveToggle}
                label="Estado del producto"
                description={editForm.active ? 'Activo — visible en el marketplace' : 'Inactivo — no aparece en búsquedas'}
              />

              {editError && <p className={styles.error}>{editError}</p>}
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        size="sm"
        title="Desactivar producto"
        footer={
          <div className={styles.confirmActions}>
            <Button label="Cancelar" variant="outline" color="neutral" onClick={() => setShowDeactivateConfirm(false)} />
            <Button label="Desactivar" variant="solid" color="danger" onClick={() => { setEdit({ active: false }); setShowDeactivateConfirm(false); }} />
          </div>
        }
      >
        <p className={styles.confirmBody}>
          El producto <strong>{editingReplacement?.globalReplacement?.name}</strong> dejará de aparecer en el marketplace. Podés volver a activarlo en cualquier momento.
        </p>
      </Modal>
    </main>
  );
}
