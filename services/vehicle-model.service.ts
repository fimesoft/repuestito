const API = process.env.NEXT_PUBLIC_API_URL;

export interface VehicleModel {
  id: string;
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
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

export function getVehicleModels(params?: { brand?: string; model?: string; country?: string }): Promise<VehicleModel[]> {
  const qs = new URLSearchParams();
  if (params?.brand) qs.set('brand', params.brand);
  if (params?.model) qs.set('model', params.model);
  if (params?.country) qs.set('country', params.country);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return fetch(`${API}/api/vehicle-models${query}`, { cache: 'no-store' }).then(r => handleResponse<VehicleModel[]>(r));
}

export function createVehicleModel(payload: {
  brand: string;
  model: string;
  yearFrom: number;
  yearTo?: number;
  country: string;
}): Promise<VehicleModel> {
  return fetch(`${API}/api/vehicle-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => handleResponse<VehicleModel>(r));
}

export function updateVehicleModel(
  id: string,
  payload: Partial<{ brand: string; model: string; yearFrom: number; yearTo: number; country: string }>,
): Promise<VehicleModel> {
  return fetch(`${API}/api/vehicle-models/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => handleResponse<VehicleModel>(r));
}

export async function deleteVehicleModel(id: string): Promise<void> {
  const res = await fetch(`${API}/api/vehicle-models/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al eliminar',
    );
  }
}
