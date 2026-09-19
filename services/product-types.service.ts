import { throwApiError } from '@/lib/api-errors';

const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/product-types`;

export interface ProductType {
  id: number;
  name: string;
  normalizedName: string;
  supportsVehicleCompatibility: boolean;
  isSystem: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ProductTypeWithCount extends ProductType {
  productsCount: number;
}

export interface PaginatedProductTypes {
  data: ProductTypeWithCount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductTypeQuery {
  search?: string;
  isVerified?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface UpdateProductTypePayload {
  name?: string;
  isVerified?: boolean;
  isActive?: boolean;
  supportsVehicleCompatibility?: boolean;
}

/** Tipo ya existente que devuelve el 409 al intentar crear un duplicado. */
export interface ExistingProductType {
  id: number;
  name: string;
  isActive: boolean;
  isVerified: boolean;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store', ...init });
  if (!res.ok) await throwApiError<ExistingProductType>(res, `Error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const getProductTypes = (query: ProductTypeQuery = {}): Promise<PaginatedProductTypes> => {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.isVerified !== undefined) params.set('isVerified', String(query.isVerified));
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  return req<PaginatedProductTypes>(`${BASE}?${params.toString()}`);
};

export const createProductType = (name: string) =>
  req<ProductType>(BASE, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name }) });

export const updateProductType = (id: number, dto: UpdateProductTypePayload) =>
  req<ProductType>(`${BASE}/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(dto) });

export const deleteProductType = (id: number) => req<void>(`${BASE}/${id}`, { method: 'DELETE' });

export const mergeProductType = (id: number, targetId: number) =>
  req<{ moved: number }>(`${BASE}/${id}/merge`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ targetId }) });
