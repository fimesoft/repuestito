export interface Branch {
  id: string;
  tenantId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateBranchPayload {
  tenantId?: string;
  name: string;
  address?: string;
  phone?: string;
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
