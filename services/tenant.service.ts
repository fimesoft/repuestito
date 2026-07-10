export interface Tenant {
  id: string;
  businessName: string;
  taxId: string;
  countryId: number | null;
  subdomain: string;
  active: boolean;
  createdAt: string;
}

export interface CreateTenantPayload {
  businessName: string;
  taxId: string;
  subdomain: string;
  countryId?: number;
}

export interface UpdateTenantPayload {
  businessName?: string;
  taxId?: string;
  subdomain?: string;
  active?: boolean;
}

export async function getTenants(): Promise<Tenant[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener los locales');
  return res.json() as Promise<Tenant[]>;
}

export async function updateTenant(id: string, payload: UpdateTenantPayload): Promise<Tenant> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al actualizar el local',
    );
  }
  return res.json() as Promise<Tenant>;
}

export async function deleteTenant(id: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar el local');
}

export async function createTenant(payload: CreateTenantPayload): Promise<Tenant> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al crear el local';
    throw new Error(message);
  }
  return res.json() as Promise<Tenant>;
}
