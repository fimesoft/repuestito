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
  replacementId: string;
  modelId: number;
  model: CompatibilityModel;
  versionId: number | null;
  version: CompatibilityVersion | null;
}

export async function getCompatibilitiesByReplacement(replacementId: string): Promise<Compatibility[]> {
  const res = await fetch(`${API}/api/replacements/${replacementId}/compatibility`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al obtener compatibilidades');
  return res.json() as Promise<Compatibility[]>;
}

export async function addCompatibility(replacementId: string, modelId: number, versionId?: number): Promise<Compatibility> {
  const res = await fetch(`${API}/api/compatibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ replacementId, modelId, versionId }),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al agregar compatibilidad',
    );
  }
  return res.json() as Promise<Compatibility>;
}

export async function removeCompatibility(compatibilityId: number): Promise<void> {
  const res = await fetch(`${API}/api/compatibility/${compatibilityId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al eliminar compatibilidad');
}
