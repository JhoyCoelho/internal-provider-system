'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { PlatformTheme, usePlatformTheme } from '../../providers/platform-theme-provider';

type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'TECNICO';
type UserStatus = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
type ManagedUser = {
  id: string;
  nome: string;
  email: string;
  role: string;
  status: UserStatus;
  createdAt: string;
  ultimoLogin: string | null;
};
type UserForm = { nome: string; email: string; role: UserRole | ''; status: UserStatus; password: string };
type ThemeColorKey = 'brandPrimary' | 'brandAccent' | 'pageBackground' | 'surfaceBackground';

const newUserForm: UserForm = { nome: '', email: '', role: 'TECNICO', status: 'ATIVO', password: '' };
const roles: { value: UserRole; label: string }[] = [
  { value: 'MASTER_ADMIN', label: 'MASTER ADMIN' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'TECNICO', label: 'TÉCNICO' },
];
const themeColors: { key: ThemeColorKey; label: string }[] = [
  { key: 'brandPrimary', label: 'Cor principal' },
  { key: 'brandAccent', label: 'Cor de destaque' },
  { key: 'pageBackground', label: 'Fundo da plataforma' },
  { key: 'surfaceBackground', label: 'Fundo de painéis' },
];

function roleLabel(role: string) {
  return roles.find((item) => item.value === role)?.label ?? role.replaceAll('_', ' ');
}

function ThemeEditor() {
  const { theme, saveTheme } = usePlatformTheme();
  const [draft, setDraft] = useState<PlatformTheme>(theme);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(theme); }, [theme]);

  async function submitTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (themeColors.some(({ key }) => !/^#[0-9a-fA-F]{6}$/.test(draft[key]))) {
      setError('Informe todas as cores no formato hexadecimal #RRGGBB.');
      return;
    }
    setSaving(true);
    try {
      await saveTheme(draft);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as cores.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitTheme} className="card space-y-5 p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Identidade visual</h2>
        <p className="mt-1 text-sm text-slate-600">As cores são compartilhadas por toda a plataforma e salvas para todos os usuários.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {themeColors.map(({ key, label }) => {
          const color = draft[key];
          const pickerValue = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000';
          return (
            <label key={key} htmlFor={key} className="text-sm font-medium text-slate-700">
              {label}
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  aria-label={`Seletor de ${label.toLowerCase()}`}
                  value={pickerValue}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                />
                <input
                  id={key}
                  required
                  value={color}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono font-normal uppercase"
                  maxLength={7}
                  placeholder="#1D4ED8"
                  aria-describedby={`${key}-preview`}
                />
                <span id={`${key}-preview`} className="sr-only">Amostra: {color}</span>
              </div>
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Cores atualizadas para toda a plataforma.</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar cores'}
      </button>
    </form>
  );
}

export default function AdministrationPage() {
  const { user } = useAuth();
  const isMasterAdmin = Boolean(user?.roles.includes('MASTER_ADMIN'));
  const [tab, setTab] = useState<'users' | 'theme'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(newUserForm);
  const [showForm, setShowForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isMasterAdmin || tab !== 'users') return;
    let active = true;
    setLoadingUsers(true);
    void apiFetch<ManagedUser[]>('/api/admin/users')
      .then((result) => { if (active) setUsers(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar usuários.'); })
      .finally(() => { if (active) setLoadingUsers(false); });
    return () => { active = false; };
  }, [isMasterAdmin, tab]);

  function beginCreate() {
    setEditingUser(null);
    setForm(newUserForm);
    setError(null);
    setMessage(null);
    setShowForm(true);
  }

  function beginEdit(managedUser: ManagedUser) {
    setEditingUser(managedUser);
    const editableRole = roles.find((role) => role.value === managedUser.role)?.value ?? '';
    setForm({ nome: managedUser.nome, email: managedUser.email, role: editableRole, status: managedUser.status, password: '' });
    setError(null);
    setMessage(null);
    setShowForm(true);
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!editingUser && form.password.length < 16) {
      setError('A senha inicial deve conter pelo menos 16 caracteres.');
      return;
    }
    if (!form.role) {
      setError('Selecione um dos tipos disponíveis: MASTER ADMIN, ADMIN ou TÉCNICO.');
      return;
    }
    setSavingUser(true);
    const body = {
      nome: form.nome,
      email: form.email,
      role: form.role,
      ...(editingUser ? { status: form.status } : {}),
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      if (editingUser) {
        const updated = await apiFetch<ManagedUser>(`/api/admin/users/${editingUser.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
        setMessage('Usuário atualizado.');
      } else {
        const created = await apiFetch<ManagedUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
        setUsers((current) => [...current, created].sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR')));
        setMessage('Usuário criado.');
      }
      setShowForm(false);
      setForm(newUserForm);
      setEditingUser(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o usuário.');
    } finally {
      setSavingUser(false);
    }
  }

  if (!isMasterAdmin) {
    return <main className="card p-6"><h1 className="text-xl font-bold text-slate-900">Acesso restrito</h1><p className="mt-2 text-sm text-slate-600">A Administração está disponível somente para MASTER ADMIN.</p></main>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 pb-6">
      <header className="px-2 py-3">
        <h1 className="text-2xl font-bold text-slate-900">Administração</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie acessos e identidade visual.</p>
      </header>
      <div role="tablist" aria-label="Seções de administração" className="flex flex-wrap gap-2 border-b border-slate-200 px-1">
        <button type="button" role="tab" aria-selected={tab === 'users'} onClick={() => setTab('users')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'users' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}>Usuários</button>
        <button type="button" role="tab" aria-selected={tab === 'theme'} onClick={() => setTab('theme')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'theme' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}>Cores da plataforma</button>
      </div>

      {tab === 'theme' ? <ThemeEditor /> : <>
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-slate-900">Usuários</h2><p className="mt-1 text-sm text-slate-500">Tipos disponíveis: MASTER ADMIN, ADMIN e TÉCNICO.</p></div>
            <button type="button" onClick={beginCreate} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">Criar usuário</button>
          </div>
          {error && !showForm && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          {loadingUsers ? <p className="py-5 text-sm text-slate-500">Carregando usuários...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-3">Nome</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Último acesso</th><th className="px-3 py-3"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{users.map((managedUser) => <tr key={managedUser.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-medium text-slate-800">{managedUser.nome}</td><td className="px-3 py-3 text-slate-600">{managedUser.email}</td><td className="px-3 py-3 text-slate-600">{roleLabel(managedUser.role)}</td><td className="px-3 py-3 text-slate-600">{managedUser.status}</td><td className="px-3 py-3 text-slate-600">{managedUser.ultimoLogin ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(managedUser.ultimoLogin)) : 'Nunca'}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => beginEdit(managedUser)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">Editar</button></td></tr>)}</tbody>
              </table>
              {!users.length && <p className="py-6 text-center text-sm text-slate-500">Nenhum usuário cadastrado.</p>}
            </div>
          )}
        </section>

        {showForm && <form onSubmit={submitUser} className="card grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">{editingUser ? 'Editar usuário' : 'Novo usuário'}</h2><button type="button" onClick={() => { setShowForm(false); setError(null); }} className="text-sm text-slate-500">Fechar</button></div>
          <label className="text-sm font-medium text-slate-700">Nome<input required minLength={2} maxLength={160} value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-medium text-slate-700">E-mail<input required type="email" maxLength={160} autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-medium text-slate-700">Tipo de usuário<select required value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="" disabled>Selecione um tipo</option>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>{editingUser && !form.role && <span className="mt-1 block text-xs font-normal text-amber-700">Este usuário usa um perfil legado. Escolha um dos três tipos antes de salvar.</span>}</label>
          {editingUser && <label className="text-sm font-medium text-slate-700">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option><option value="BLOQUEADO">Bloqueado</option></select></label>}
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">{editingUser ? 'Nova senha (opcional)' : 'Senha inicial'}<input required={!editingUser} type="password" minLength={16} maxLength={72} autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder={editingUser ? 'Deixe em branco para manter a senha atual' : 'Mínimo de 16 caracteres'} />{editingUser && <span className="mt-1 block text-xs font-normal text-slate-500">O campo não revela a senha atual; preencha somente para redefini-la.</span>}</label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={savingUser} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingUser ? 'Salvando...' : editingUser ? 'Salvar alterações' : 'Criar usuário'}</button><button type="button" onClick={() => { setShowForm(false); setError(null); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button></div>
        </form>}
      </>}
    </main>
  );
}