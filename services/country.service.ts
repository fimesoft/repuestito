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

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store', ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string };
    throw new Error(body.code ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const getCountries = () => req<Country[]>(BASE);
export const createCountry = (dto: CreateCountryPayload) =>
  req<Country>(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
export const updateCountry = (id: number, dto: UpdateCountryPayload) =>
  req<Country>(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
export const deleteCountry = (id: number) => req<void>(`${BASE}/${id}`, { method: 'DELETE' });
