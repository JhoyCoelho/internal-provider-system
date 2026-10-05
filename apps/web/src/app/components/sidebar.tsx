'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/auth-provider';

const items: { href: string; label: string; permission?: string; role?: string; disabled?: boolean }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/remocao', label: 'Remoção', permission: 'ORDERS_READ' },
  { href: '/dashboard/checklists', label: 'Checklists', permission: 'CHECKLIST_READ' },
  { href: '/dashboard/caixa', label: 'Caixa', permission: 'CASH_READ', disabled: true },
  { href: '/dashboard/auditoria', label: 'Auditoria', permission: 'AUDIT_READ' },
  { href: '/dashboard/administracao', label: 'Administração', role: 'MASTER_ADMIN' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const visibleItems = items.filter((item) =>
    (!item.permission || user?.permissions.includes(item.permission))
    && (!item.role || user?.roles.includes(item.role)));

  return (
    <aside className="platform-surface h-full w-full rounded-3xl border border-slate-200 p-4 shadow-soft">
      <div className="mb-6 px-3 py-2">
        <h2 className="text-xl font-bold text-slate-800">Fyberlink</h2>
      </div>

      <nav className="space-y-2">
        {visibleItems.map((item) => {
          const active = pathname === item.href;

          return (
            item.disabled ? (
              <div key={item.href} aria-disabled="true" className="flex cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400">
                <span>{item.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-400">EM BREVE</span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'nav-accent bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            )
          );
        })}
      </nav>

      <div className="mt-8 border-t border-slate-200 px-3 pt-4">
        <p className="truncate text-sm font-semibold text-slate-800">{user?.nome}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{user?.roles.map((role) => role === 'MASTER_ADMIN' ? 'MASTER ADMIN' : role === 'TECNICO' ? 'TÉCNICO' : role.replaceAll('_', ' ')).join(', ')}</p>
      </div>

      <button
        type="button"
        onClick={logout}
        className="mt-8 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        Encerrar sessão
      </button>
    </aside>
  );
}
