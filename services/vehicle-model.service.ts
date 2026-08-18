const API = process.env.NEXT_PUBLIC_API_URL;

export interface VehicleModel {
  id: number;
  name: string;
  brandId: number;
  brand: { id: number; name: string };
}

export async function searchVehicleModels(search: string): Promise<VehicleModel[]> {
  const params = new URLSearchParams({ search });
  const res = await fetch(`${API}/api/vehicle-models?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al buscar modelos');
  return res.json() as Promise<VehicleModel[]>;
}
