import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/30">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">ISP Internal</p>
          <h1 className="mt-3 text-3xl font-bold text-white">Acesso ao sistema</h1>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
