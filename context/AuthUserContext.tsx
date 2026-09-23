'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { getMeClient, type AuthUser } from '@/services/auth.service';
import { useCountry } from '@/context/CountryContext';
import { hasRole } from '@/lib/roles';

interface AuthUserContextValue {
  currentUser: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const AuthUserContext = createContext<AuthUserContextValue | null>(null);

export function AuthUserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCountry } = useCountry();

  // Solo GOD elige el país (CountrySelect); el resto trabaja con el país de su local.
  // Se fija junto con currentUser para que las páginas no disparen fetches con el país default.
  const applyUser = useCallback((user: AuthUser | null) => {
    if (user?.tenantCountry && !hasRole(user.role, 'ADMIN')) setCountry(user.tenantCountry);
    setCurrentUser(user);
  }, [setCountry]);

  const refetch = useCallback(async () => {
    applyUser(await getMeClient());
  }, [applyUser]);

  useEffect(() => {
    getMeClient().then(user => {
      applyUser(user);
      setLoading(false);
    });

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [applyUser]);

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
