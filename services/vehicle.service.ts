const API = process.env.NEXT_PUBLIC_API_URL;

export interface VehicleBrand  { id: number; name: string; slug: string }
export interface VehicleModel  { id: number; brandId: number; name: string; versionsCount: number }
export interface VehicleVersion {
  id: number; modelId: number; countryId: number;
  externalId: string; name: string; availableYears: number[];
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${url}`, { credentials: 'include', ...init });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : `Error ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Brands
export const getBrands = ()                           => req<VehicleBrand[]>('/vehicle-brands');
export const createBrand = (body: { name: string; slug?: string }) => req<VehicleBrand>('/vehicle-brands', json(body));
export const updateBrand = (id: number, body: Partial<VehicleBrand>) =>
  req<VehicleBrand>(`/vehicle-brands/${id}`, { ...json(body), method: 'PUT' });
export const deleteBrand = (id: number) => req<void>(`/vehicle-brands/${id}`, { method: 'DELETE' });

// Models
export const getModels = (brandId: number) =>
  req<VehicleModel[]>(`/vehicle-models?brandId=${brandId}`);
export const createModel = (body: { brandId: number; name: string }) =>
  req<VehicleModel>('/vehicle-models', json(body));
export const updateModel = (id: number, body: Partial<VehicleModel>) =>
  req<VehicleModel>(`/vehicle-models/${id}`, { ...json(body), method: 'PUT' });
export const deleteModel = (id: number) => req<void>(`/vehicle-models/${id}`, { method: 'DELETE' });

// Versions
export const getVersions = (modelId: number) =>
  req<VehicleVersion[]>(`/vehicle-versions?modelId=${modelId}`);
export const createVersion = (body: Omit<VehicleVersion, 'id'>) =>
  req<VehicleVersion>('/vehicle-versions', json(body));
export const updateVersion = (id: number, body: Partial<VehicleVersion>) =>
  req<VehicleVersion>(`/vehicle-versions/${id}`, { ...json(body), method: 'PUT' });
export const deleteVersion = (id: number) => req<void>(`/vehicle-versions/${id}`, { method: 'DELETE' });
