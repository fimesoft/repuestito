import { CompatibilityCountry } from '@/lib/compatibility-countries';
import { VehicleModel } from './vehicle-model.service';

const API = process.env.NEXT_PUBLIC_API_URL;

export interface CompatibilityEntry {
  id: string;
  replacementId: string;
  vehicleModelId: string;
  vehicleModel: VehicleModel;
  country: string;
  createdAt: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error inesperado',
    );
  }
  return res.json() as Promise<T>;
}

export function getCompatibilityByReplacement(
  country: CompatibilityCountry,
  replacementId: string,
): Promise<CompatibilityEntry[]> {
  return fetch(`${API}/api/compatibility/${country}/replacement/${replacementId}`, { cache: 'no-store' })
    .then(r => handleResponse<CompatibilityEntry[]>(r));
}

export function getCompatibilityByVehicleModel(
  country: CompatibilityCountry,
  vehicleModelId: string,
): Promise<CompatibilityEntry[]> {
  return fetch(`${API}/api/compatibility/${country}/vehicle-model/${vehicleModelId}`, { cache: 'no-store' })
    .then(r => handleResponse<CompatibilityEntry[]>(r));
}

export function addCompatibility(
  country: CompatibilityCountry,
  payload: { replacementId: string; vehicleModelId: string },
): Promise<CompatibilityEntry> {
  return fetch(`${API}/api/compatibility/${country}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, country }),
  }).then(r => handleResponse<CompatibilityEntry>(r));
}

export async function removeCompatibility(
  country: CompatibilityCountry,
  replacementId: string,
  vehicleModelId: string,
): Promise<void> {
  const res = await fetch(`${API}/api/compatibility/${country}/${replacementId}/${vehicleModelId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar compatibilidad');
}
