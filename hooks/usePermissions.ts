'use client';

import { useEffect, useState } from 'react';
import { getMeClient, AuthUser } from '@/services/auth.service';

export interface Permissions {
  currentUser: AuthUser | null;
  isAdmin: boolean;
  canManage: boolean; // GOD or MODERATOR — can create/edit/delete
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

  return {
    currentUser,
    isAdmin: currentUser?.role === 'GOD',
    canManage: currentUser?.role === 'GOD' || currentUser?.role === 'MODERATOR',
    loading,
  };
}
