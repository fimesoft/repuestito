
export interface Replacement {
  id: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string | null;
  codeOem: string | null;
  stock: number;
  tenantId: string;
  branchId: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReplacementPayload {
  name: string;
  brand: string;
  price: number;
  country: string;
  latitude?: number;
  longitude?: number;
  tenantId: string;
  stock?: number;
  codeOem?: string;
  imageUrl?: string;
  branchId?: string;
}

export async function createReplacement(payload: CreateReplacementPayload): Promise<Replacement> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/replacements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al crear el repuesto',
    );
  }
  return res.json() as Promise<Replacement>;
}

export interface UpdateReplacementPayload {
  name?: string;
  brand?: string;
  price?: number;
  stock?: number;
  codeOem?: string;
  imageUrl?: string;
  branchId?: string;
  tenantId?: string;
  latitude?: number;
  longitude?: number;
}

export async function updateReplacement(id: string, payload: UpdateReplacementPayload): Promise<Replacement> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al actualizar el repuesto',
    );
  }
  return res.json() as Promise<Replacement>;
}

export async function deleteReplacement(id: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar el repuesto');
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
}

export async function getReplacement(id: string, options?: RequestInit): Promise<Replacement> {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/replacements/${id}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error('Error al obtener el repuesto');
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

  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/replacements?${params.toString()}`;
  console.log(url)
  const res = await fetch(url, options);
  if (!res.ok) throw new Error('Error al obtener los repuestos');
  return res.json() as Promise<PaginatedResult>;
}
