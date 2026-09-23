import { translateApiError } from '@/lib/api-errors';

export interface DocumentType {
  id: number;
  countryId: number | null;
  code: string;
  name: string;
  pattern: string | null;
  placeholder: string | null;
  minLength: number | null;
  maxLength: number | null;
  isDefault: boolean;
}

export async function getDocumentTypes(countryId: number): Promise<DocumentType[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/document-types?countryId=${countryId}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new Error(translateApiError(data, 'Error al obtener los tipos de documento'));
  }
  return res.json() as Promise<DocumentType[]>;
}
