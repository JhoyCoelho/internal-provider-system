'use client';

import { Sidebar } from '../components/sidebar';
import { AuthProvider, useAuth } from '../providers/auth-provider';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Validando sessão...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-2 sm:p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-3 sm:gap-6 xl:grid-cols-[220px_1fr]">
        <Sidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
