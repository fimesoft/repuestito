import { getApiErrorCode, translateApiError } from '@/lib/api-errors';

const API = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export type UserTheme = 'LIGHT' | 'DARK';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  branchId: string | null;
  /** País (ISO alpha-2) del local del usuario; null si todavía no tiene local. */
  tenantCountry: string | null;
  isEmailVerified: boolean;
  active: boolean;
  theme: UserTheme;
  createdAt: string;
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
    throw new ApiError(translateApiError(data), getApiErrorCode(data));
  }
  return data as T;
}

export function register(email: string, password: string) {
  return request<{ message: string }>('register', { email, password });
}

export function verifyEmail(email: string, code: string) {
  return request<{ message: string }>('verify-email', { email, code });
}

export function resendVerification(email: string) {
  return request<{ message: string }>('resend-verification', { email });
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

export async function getMeClient(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json() as Promise<AuthUser>;
  } catch {
    return null;
  }
}

export async function getMe(cookieHeader: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<AuthUser>;
  } catch {
    return null;
  }
}
