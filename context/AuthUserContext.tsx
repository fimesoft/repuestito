'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
