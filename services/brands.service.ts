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

export async function getBrands(countryCode?: string): Promise<Brand[]> {
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/brand-replacements`);
  if (countryCode) url.searchParams.set('countryCode', countryCode);
  const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener las marcas');
  return res.json() as Promise<Brand[]>;
}
