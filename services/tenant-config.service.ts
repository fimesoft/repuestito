import { translateApiError } from '@/lib/api-errors';

const API = process.env.NEXT_PUBLIC_API_URL;

export interface TenantConfig {
  tenantId: string;
  lowStockMax: number;
  normalStockMax: number;
}

export interface UpdateTenantConfigPayload {
  lowStockMax?: number;
  normalStockMax?: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(translateApiError(data));
  }
  return res.json() as Promise<T>;
}

export function getTenantConfig(): Promise<TenantConfig> {
  return fetch(`${API}/api/tenant-config`, { cache: 'no-store', credentials: 'include' }).then(r =>
    handleResponse<TenantConfig>(r),
  );
}

export function updateTenantConfig(payload: UpdateTenantConfigPayload): Promise<TenantConfig> {
  return fetch(`${API}/api/tenant-config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }).then(r => handleResponse<TenantConfig>(r));
}
