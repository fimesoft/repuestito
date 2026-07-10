export interface Branch {
  id: string;
  tenantId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateBranchPayload {
  tenantId?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
}

export interface UpdateBranchPayload {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  active?: boolean;
}

export async function getBranches(tenantId?: string): Promise<Branch[]> {
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/branches`);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener las sucursales');
  return res.json() as Promise<Branch[]>;
}

export async function updateBranch(id: string, payload: UpdateBranchPayload): Promise<Branch> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/branches/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al actualizar la sucursal',
    );
  }
  return res.json() as Promise<Branch>;
}

export async function deleteBranch(id: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/branches/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar la sucursal');
}

export async function createBranch(payload: CreateBranchPayload): Promise<Branch> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al crear la sucursal';
    throw new Error(message);
  }
  return res.json() as Promise<Branch>;
}
