'use client';

import { useEffect, useState } from 'react';
import { getMeClient, AuthUser } from '@/services/auth.service';
import { hasRole as checkRole, type Role } from '@/lib/roles';

export type { Role };

export interface Permissions {
  currentUser: AuthUser | null;
  isAdmin: boolean;
  canManage: boolean; // GOD or MODERATOR — can create/edit/delete
  hasRole: (minRole: Role) => boolean; // true si el rol del usuario es >= minRole
  loading: boolean;
}

export function usePermissions(): Permissions {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMeClient().then(user => {
      setCurrentUser(user);
      setLoading(false);
    });
  }, []);

  function hasRole(minRole: Role): boolean {
    return checkRole(currentUser?.role, minRole);
  }

  return {
    currentUser,
    isAdmin: hasRole('ADMIN'),
    canManage: hasRole('MODERATOR'),
    hasRole,
    loading,
  };
}
