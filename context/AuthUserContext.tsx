'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { getMeClient, type AuthUser } from '@/services/auth.service';

interface AuthUserContextValue {
  currentUser: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const AuthUserContext = createContext<AuthUserContextValue | null>(null);

export function AuthUserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const user = await getMeClient();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    getMeClient().then(user => {
      setCurrentUser(user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      Sentry.setUser(null);
      Sentry.setTag('tenant.id', 'none');
      Sentry.setTag('branch.id', 'none');
      Sentry.setTag('user.role', 'anonymous');
      return;
    }

    Sentry.setUser({ id: currentUser.id });
    Sentry.setTag('tenant.id', currentUser.tenantId ?? 'none');
    Sentry.setTag('branch.id', currentUser.branchId ?? 'none');
    Sentry.setTag('user.role', currentUser.role);

    const theme = currentUser.theme === 'DARK' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('piezify-theme', theme);
  }, [currentUser]);

  return (
    <AuthUserContext.Provider value={{ currentUser, loading, refetch }}>
      {children}
    </AuthUserContext.Provider>
  );
}

export function useAuthUser(): AuthUserContextValue {
  const ctx = useContext(AuthUserContext);
  if (!ctx) throw new Error('useAuthUser must be used inside AuthUserProvider');
  return ctx;
}
