const API = process.env.NEXT_PUBLIC_API_URL;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

async function request<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error inesperado';
    throw new Error(message);
  }
  return data as T;
}

export function register(email: string, password: string) {
  return request<{ message: string }>('register', { email, password });
}

export function verifyEmail(email: string, code: string) {
  return request<{ message: string }>('verify-email', { email, code });
}

export function login(email: string, password: string) {
  return request<{ user: AuthUser }>('login', { email, password });
}

export function forgotPassword(email: string) {
  return request<{ message: string }>('forgot-password', { email });
}

export function resetPassword(email: string, code: string, password: string) {
  return request<{ message: string }>('reset-password', { email, code, password });
}

export async function logout() {
  await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}
