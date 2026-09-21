import { Brand } from './brands.service';
import { ProductType } from './product-types.service';
import { translateApiError } from '@/lib/api-errors';

export interface GlobalReplacementInfo {
  id: number;
  name: string;
  brand: Brand;
  productType?: ProductType;
  sku: string | null;
  imageUrl: string | null;
  countryCode: string;
  isVerified: boolean;
}

export interface BranchInfo {
  name: string;
}

export interface Replacement {
  id: string;
  globalReplacement: GlobalReplacementInfo;
  price: number;
  /** Costo unitario (el API lo envía como texto decimal); null = desconocido. Solo llega en endpoints de tu tenant. */
  cost?: string | number | null;
  stock: number;
  tenantId: string;
  branchId: string | null;
  branch: BranchInfo | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  createdAt: string;
}

export interface CreateReplacementPayload {
  name: string;
  brandId: number;
  countryCode: string;
  productTypeId?: number;
  sku?: string;
  imageUrl?: string;
  price: number;
  cost?: number;
  tenantId: string;
  branchId?: string;
  stock?: number;
  latitude?: number;
  longitude?: number;
}

export async function createReplacement(payload: CreateReplacementPayload): Promise<Replacement> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/replacements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new Error(translateApiError(data, 'Error al crear el producto'));
  }
  return res.json() as Promise<Replacement>;
}

/** Producto del catálogo compartido con ese SKU en el país, o null si no existe. */
export async function getGlobalBySku(sku: string, countryCode: string): Promise<GlobalReplacementInfo | null> {
  const params = new URLSearchParams({ sku, countryCode });
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/global-replacements/by-sku?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al buscar el SKU');
  const body = (await res.json()) as { data: GlobalReplacementInfo | null };
  return body.data;
}

export interface UpdateReplacementPayload {
  price?: number;
  /** null borra el costo (queda desconocido). */
  cost?: number | null;
  stock?: number;
  latitude?: number;
  longitude?: number;
  branchId?: string;
  active?: boolean;
  imageUrl?: string;
}

export async function updateReplacement(id: string, payload: UpdateReplacementPayload): Promise<Replacement> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new Error(translateApiError(data, 'Error al actualizar el producto'));
  }
  return res.json() as Promise<Replacement>;
}

export async function deleteReplacement(id: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Error al eliminar el producto');
}

export interface PaginatedResult {
  data: Replacement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReplacementQuery {
  search?: string;
  page?: number;
  limit?: number;
  country?: string;
  productTypeId?: number;
  ids?: string;
  active?: boolean;
  from?: string;
  to?: string;
}

export async function getReplacement(id: string, options?: RequestInit): Promise<Replacement> {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${id}`;
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) throw new Error('Error al obtener el producto');
  return res.json() as Promise<Replacement>;
}

export async function getReplacements(
  query: ReplacementQuery = {},
  options?: RequestInit,
): Promise<PaginatedResult> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.country) params.set('country', query.country);
  if (query.productTypeId) params.set('productTypeId', String(query.productTypeId));
  if (query.ids) params.set('ids', query.ids);
  if (query.active !== undefined) params.set('active', String(query.active));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);

  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/replacements?${params.toString()}`;
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) throw new Error('Error al obtener los productos');
  return res.json() as Promise<PaginatedResult>;
}
