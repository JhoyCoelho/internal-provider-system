'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch<{ user: { id: string; nome: string; email: string } }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao efetuar login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          E-mail corporativo
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-brand-600"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-brand-600"
        />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
