import { throwApiError } from '@/lib/api-errors';

const API = process.env.NEXT_PUBLIC_API_URL;

export interface CompatibilityModel {
  id: number;
  name: string;
  brand: { id: number; name: string };
}

export interface CompatibilityVersion {
  id: number;
  name: string;
  availableYears: number[];
}

export interface Compatibility {
  id: number;
  globalReplacementId: number;
  modelId: number;
  model: CompatibilityModel;
  versionId: number | null;
  version: CompatibilityVersion | null;
}

export async function getCompatibilitiesByGlobalReplacement(globalReplacementId: number): Promise<Compatibility[]> {
  const res = await fetch(`${API}/api/global-replacements/${globalReplacementId}/compatibility`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al obtener compatibilidades');
  return res.json() as Promise<Compatibility[]>;
}

export async function addCompatibility(globalReplacementId: number, modelId: number, versionId?: number): Promise<Compatibility> {
  const res = await fetch(`${API}/api/compatibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ globalReplacementId, modelId, versionId }),
  });
  if (!res.ok) await throwApiError(res, 'Error al agregar compatibilidad');
  return res.json() as Promise<Compatibility>;
}

export async function removeCompatibility(compatibilityId: number): Promise<void> {
  const res = await fetch(`${API}/api/compatibility/${compatibilityId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) await throwApiError(res, 'Error al eliminar compatibilidad');
}
