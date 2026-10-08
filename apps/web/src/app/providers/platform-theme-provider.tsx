'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export type PlatformTheme = {
  providerName: string;
  logoDataUrl: string | null;
  brandPrimary: string;
  brandAccent: string;
  pageBackground: string;
  surfaceBackground: string;
  textPrimary: string;
  textSecondary: string;
  updatedAt?: string;
};

type PlatformThemeContextValue = {
  theme: PlatformTheme;
  saveTheme: (theme: PlatformTheme) => Promise<PlatformTheme>;
};

const defaultTheme: PlatformTheme = {
  providerName: 'Fyberlink',
  logoDataUrl: null,
  brandPrimary: '#1d4ed8',
  brandAccent: '#0f766e',
  pageBackground: '#f8fafc',
  surfaceBackground: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
};

const PlatformThemeContext = createContext<PlatformThemeContextValue | undefined>(undefined);

function applyTheme(theme: PlatformTheme) {
  const root = document.documentElement;
  root.style.setProperty('--app-brand-primary', theme.brandPrimary);
  root.style.setProperty('--app-brand-accent', theme.brandAccent);
  root.style.setProperty('--app-page-background', theme.pageBackground);
  root.style.setProperty('--app-surface-background', theme.surfaceBackground);
  root.style.setProperty('--app-text-primary', theme.textPrimary);
  root.style.setProperty('--app-text-secondary', theme.textSecondary);
  root.style.setProperty('--foreground', theme.textPrimary);
}

export function PlatformThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    let active = true;
    void apiFetch<PlatformTheme>('/api/platform-theme')
      .then((savedTheme) => {
        if (active) setTheme(savedTheme);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme]);

  async function saveTheme(nextTheme: PlatformTheme) {
    const savedTheme = await apiFetch<PlatformTheme>('/api/platform-theme', {
      method: 'PUT',
      body: JSON.stringify({
        providerName: nextTheme.providerName,
        logoDataUrl: nextTheme.logoDataUrl,
        brandPrimary: nextTheme.brandPrimary,
        brandAccent: nextTheme.brandAccent,
        pageBackground: nextTheme.pageBackground,
        surfaceBackground: nextTheme.surfaceBackground,
        textPrimary: nextTheme.textPrimary,
        textSecondary: nextTheme.textSecondary,
      }),
    });
    setTheme(savedTheme);
    return savedTheme;
  }

  return (
    <PlatformThemeContext.Provider value={{ theme, saveTheme }}>
      {children}
    </PlatformThemeContext.Provider>
  );
}

export function usePlatformTheme() {
  const context = useContext(PlatformThemeContext);
  if (!context) throw new Error('usePlatformTheme deve ser usado dentro de PlatformThemeProvider.');
  return context;
}