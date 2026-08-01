const API = process.env.NEXT_PUBLIC_API_URL;

export interface CarBrand {
  id: number;
  name: string;
  slug: string;
  country: string | null;
}

export function getCarBrands(params?: { search?: string; country?: string }): Promise<CarBrand[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.country) qs.set('country', params.country);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return fetch(`${API}/api/car-brands${query}`, { cache: 'no-store' }).then(r => r.json() as Promise<CarBrand[]>);
}
