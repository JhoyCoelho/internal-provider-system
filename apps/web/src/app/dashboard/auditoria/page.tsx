'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type AuditLog = {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  createdAt: string;
  usuario: { id: string; nome: string; email: string } | null;
};

type Filters = { entidade: string; colaborador: string; acao: string; from: string; to: string };
const emptyFilters: Filters = { entidade: '', colaborador: '', acao: '', from: '', to: '' };
const entities = [
  { value: '', label: 'Todos os módulos' },
  { value: 'REMOCAO', label: 'Remoções' },
  { value: 'CHECKLIST', label: 'Checklists' },
  { value: 'CAIXA', label: 'Caixa' },
  { value: 'USUARIO', label: 'Usuários' },
  { value: 'PERMISSAO', label: 'Permissões' },
];

function downloadLogs(logs: AuditLog[]) {
  const rows = [
    ['Data/hora', 'Colaborador', 'E-mail', 'Módulo', 'Ação', 'Registro'],
    ...logs.map((log) => [new Date(log.createdAt).toLocaleString('pt-BR'), log.usuario?.nome ?? 'Sistema', log.usuario?.email ?? '', log.entidade, log.acao, log.entidadeId ?? '']),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'auditoria.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (applied.entidade) params.set('entidade', applied.entidade);
      if (applied.colaborador.trim()) params.set('colaborador', applied.colaborador.trim());
      if (applied.acao.trim()) params.set('acao', applied.acao.trim());
      if (applied.from) params.set('from', new Date(`${applied.from}T00:00:00`).toISOString());
      if (applied.to) params.set('to', new Date(`${applied.to}T23:59:59.999`).toISOString());
      setLogs(await apiFetch<AuditLog[]>(`/api/auditoria${params.size ? `?${params}` : ''}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [applied]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setApplied(filters);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 pb-6">
      <header className="flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Auditoria</h1><p className="mt-1 text-sm text-slate-500">Ações registradas nas sessões do sistema.</p></div>
        <button type="button" onClick={() => downloadLogs(logs)} disabled={!logs.length} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Exportar resultados</button>
      </header>

      <form onSubmit={applyFilters} className="card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Módulo<select value={filters.entidade} onChange={(event) => setFilters((current) => ({ ...current, entidade: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Todos os módulos</option>{entities.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Colaborador<input value={filters.colaborador} onChange={(event) => setFilters((current) => ({ ...current, colaborador: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Nome do colaborador" /></label>
        <label className="text-sm font-medium text-slate-700">Ação<input value={filters.acao} onChange={(event) => setFilters((current) => ({ ...current, acao: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Filtrar pela ação" /></label>
        <label className="text-sm font-medium text-slate-700">Data inicial<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Data final<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <div className="flex gap-2 self-end"><button type="submit" className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">Aplicar filtros</button><button type="button" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600">Limpar</button></div>
      </form>

      {message && <p role="status" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p>}
      {loading ? <p className="p-4 text-sm text-slate-500">Carregando auditoria...</p> : logs.length === 0 ? <div className="card p-8 text-center text-sm text-slate-500">Nenhum evento encontrado para os filtros selecionados.</div> : <section className="grid gap-3">{logs.map((log) => <article key={log.id} className="card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-900">{log.acao}</strong><time className="text-xs text-slate-500">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))}</time></div><p className="mt-2 text-sm text-slate-600">{log.usuario?.nome ?? 'Sistema'} · {log.entidade}{log.entidadeId ? ` · ${log.entidadeId}` : ''}</p></article>)}</section>}
    </main>
  );
}
