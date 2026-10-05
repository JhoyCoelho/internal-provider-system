import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="login-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="login-panel w-full max-w-md rounded-3xl border border-slate-200 p-8 shadow-2xl shadow-slate-950/10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">ISP Internal</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Acesso ao sistema</h1>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
