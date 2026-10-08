'use client';

import Image from 'next/image';
import { LoginForm } from './login-form';
import { usePlatformTheme } from '../providers/platform-theme-provider';

export default function LoginPage() {
  const { theme } = usePlatformTheme();
  return (
    <main className="login-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="login-panel w-full max-w-md rounded-3xl border border-slate-200 p-8 shadow-2xl shadow-slate-950/10">
        <div className="mb-8 text-center">
          <div className="flex min-h-20 items-center justify-center">
            {theme.logoDataUrl
              ? <Image src={theme.logoDataUrl} alt={`Logo ${theme.providerName}`} width={220} height={100} unoptimized className="max-h-24 w-auto object-contain" />
              : <p className="text-xl font-bold text-slate-800">{theme.providerName}</p>}
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Login</h1>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
