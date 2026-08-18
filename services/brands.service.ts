const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/brand-replacements`;

export interface PaginatedBrands {
  data: Brand[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BrandQuery {
  search?: string;
  countryCode?: string;
  page?: number;
  limit?: number;
}

export interface Brand {
  id: number;
  name: string;
  normalizedName: string;
  countryCode: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateBrandPayload {
  name: string;
  countryCode?: string;
  logoUrl?: string;
  isVerified?: boolean;
  isActive?: boolean;
}

export type UpdateBrandPayload = Partial<CreateBrandPayload>;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store', ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string };
    throw new Error(body.code ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const getBrands = (query: BrandQuery = {}): Promise<PaginatedBrands> => {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.countryCode) params.set('countryCode', query.countryCode);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  return req<PaginatedBrands>(`${BASE}?${params.toString()}`);
};
export const createBrand = (dto: CreateBrandPayload) =>
  req<Brand>(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
export const updateBrand = (id: number, dto: UpdateBrandPayload) =>
  req<Brand>(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
export const deleteBrand = (id: number) => req<void>(`${BASE}/${id}`, { method: 'DELETE' });
