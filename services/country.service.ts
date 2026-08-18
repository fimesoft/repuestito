const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/countries`;

export interface Country {
  id: number;
  name: string;
  code: string;
  codeAlpha3: string | null;
  currencyCode: string | null;
  phoneCode: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateCountryPayload {
  name: string;
  code: string;
  codeAlpha3?: string;
  currencyCode?: string;
  phoneCode?: string;
  active?: boolean;
}

export type UpdateCountryPayload = Partial<CreateCountryPayload>;

export interface PaginatedCountries {
  data: Country[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CountryQuery {
  search?: string;
  page?: number;
  limit?: number;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store', ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string };
    throw new Error(body.code ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const getCountries = (query: CountryQuery = {}): Promise<PaginatedCountries> => {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  return req<PaginatedCountries>(`${BASE}?${params.toString()}`);
};
export const createCountry = (dto: CreateCountryPayload) =>
  req<Country>(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
export const updateCountry = (id: number, dto: UpdateCountryPayload) =>
  req<Country>(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
export const deleteCountry = (id: number) => req<void>(`${BASE}/${id}`, { method: 'DELETE' });
