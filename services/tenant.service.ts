import type { Branch } from './branch.service';
import { getApiErrorCode, translateApiError } from '@/lib/api-errors';
import { ApiError } from './auth.service';

export interface Tenant {
  id: string;
  businessName: string;
  taxId: string;
  country: string | null;
  /** null en locales creados antes de que existieran los tipos de documento. */
  documentType: { code: string; name: string } | null;
  subdomain: string;
  active: boolean;
  createdAt: string;
}

export interface CreateTenantPayload {
  businessName: string;
  taxId: string;
  country: string;
  documentTypeId: number;
  /** Solo en el onboarding propio: nombre y apellido del usuario que crea el local. */
  owner?: {
    name: string;
    lastname: string;
  };
  branch: {
    name: string;
    address?: string;
    phone?: string;
  };
}

export interface TenantWithBranch {
  tenant: Tenant;
  branch: Branch;
}

export interface UpdateTenantPayload {
  businessName?: string;
  taxId?: string;
  subdomain?: string;
  active?: boolean;
}

export async function getTenants(country?: string): Promise<Tenant[]> {
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants`);
  if (country) url.searchParams.set('country', country);
  const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener los locales');
  return res.json() as Promise<Tenant[]>;
}

export async function updateTenant(id: string, payload: UpdateTenantPayload): Promise<Tenant> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new Error(translateApiError(data, 'Error al actualizar el local'));
  }
  return res.json() as Promise<Tenant>;
}

export async function deleteTenant(id: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Error al eliminar el local');
}

export async function createTenant(payload: CreateTenantPayload): Promise<TenantWithBranch> {
  const genericError = 'No pudimos crear tu local, intentá de nuevo';
  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(genericError);
  }
  if (res.status >= 500) throw new Error(genericError);
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw new ApiError(translateApiError(data, 'Error al crear el local'), getApiErrorCode(data));
  }
  return res.json() as Promise<TenantWithBranch>;
}
