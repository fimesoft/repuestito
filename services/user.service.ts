const API = process.env.NEXT_PUBLIC_API_URL;

export interface UserRecord {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  tenantId: string | null;
  branchId: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role?: string;
  tenantId?: string;
  branchId?: string;
}

export interface InviteUserPayload {
  email: string;
  role?: string;
  tenantId?: string;
  branchId?: string;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: string;
  tenantId?: string | null;
  branchId?: string | null;
  active?: boolean;
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

export function getUsers(): Promise<UserRecord[]> {
  return fetch(`${API}/api/users`, { cache: 'no-store' }).then(r => handleResponse<UserRecord[]>(r));
}

export function createUser(payload: CreateUserPayload): Promise<UserRecord> {
  return fetch(`${API}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => handleResponse<UserRecord>(r));
}

export function inviteUser(payload: InviteUserPayload): Promise<{ message: string; devCode?: string }> {
  return fetch(`${API}/api/auth/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => handleResponse<{ message: string }>(r));
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<UserRecord> {
  return fetch(`${API}/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => handleResponse<UserRecord>(r));
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API}/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar el usuario');
}
