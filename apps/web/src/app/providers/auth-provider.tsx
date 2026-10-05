'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { API_BASE_URL, apiFetch } from '../lib/api';

type AuthUser = {
  id: string;
  nome: string;
  email: string;
  roles: string[];
  permissions: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me`, {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Sessão inválida');
        }

        const payload = await response.json();
        setUser(payload.user);
      } catch {
        setUser(null);

        if (pathname.startsWith('/dashboard')) {
          router.replace('/login');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      logout: () => {
        void apiFetch('/api/auth/logout', { method: 'POST' })
          .catch(() => undefined)
          .finally(() => {
            setUser(null);
            router.replace('/login');
          });
      },
    }),
    [isLoading, router, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
