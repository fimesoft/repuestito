'use client';

import type { AuthUser } from '@/services/auth.service';
import { useAuthUser } from '@/context/AuthUserContext';
import { hasRole as checkRole, type Role } from '@/lib/roles';

export type { Role };

export interface Permissions {
  currentUser: AuthUser | null;
  isAdmin: boolean;
  canManage: boolean; // GOD or MODERATOR — can create/edit/delete
  hasRole: (minRole: Role) => boolean; // true si el rol del usuario es >= minRole
  needsOnboarding: boolean; // logueado pero sin tenant/branch asignado
  loading: boolean;
}

export function usePermissions(): Permissions {
  const { currentUser, loading } = useAuthUser();

  function hasRole(minRole: Role): boolean {
    return checkRole(currentUser?.role, minRole);
  }

  return {
    currentUser,
    isAdmin: hasRole('ADMIN'),
    canManage: hasRole('MODERATOR'),
    hasRole,
    needsOnboarding: currentUser !== null && currentUser.tenantId === null,
    loading,
  };
}
