export interface Replacement {
  id: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string | null;
  codeOem: string | null;
  stock: number;
  storeId: string | null;
  sellerId: string | null;
  country: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
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

  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/replacements?${params.toString()}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error('Error al obtener los repuestos');
  return res.json() as Promise<PaginatedResult>;
}
