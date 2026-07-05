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
