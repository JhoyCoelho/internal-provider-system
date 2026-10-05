'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type ChecklistIssue = {
  id: string;
  valorTexto: string | null;
  valorBooleano: boolean | null;
  registradoEm: string;
  template: { pergunta: string };
  checklist: { id: string; categoria: string; dataPreenchimento: string; justificativaAtraso: string | null; usuario: { nome: string } };
};

type DashboardSummary = {
  checklists: { pending: number; filled: number; filledLate: number; issuesToResolve: ChecklistIssue[] };
  removals: { completed: number; open: number; failed: number; routes: number | null };
};

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function dateRangeLabel(from: string, to: string) {
  if (!from && !to) return 'Período geral';
  return `${from || 'Início'} até ${to || 'Hoje'}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
      setSummary(await apiFetch<DashboardSummary>(`/api/dashboard${params.size ? `?${params}` : ''}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os indicadores.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSummary(); }, [from, to]);

  async function resolveIssue(issue: ChecklistIssue) {
    setResolvingId(issue.id);
    try {
      await apiFetch(`/api/dashboard/checklist-responses/${issue.id}/resolve`, { method: 'PATCH' });
      await loadSummary();
      setMessage('Item marcado como resolvido.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível resolver o item.');
    } finally {
      setResolvingId(null);
    }
  }

  function exportChecklistReport() {
    if (!summary) return;
    const rows: (string | number)[][] = [
      ['Relatório de Checklists', dateRangeLabel(from, to)],
      ['Pendentes', summary.checklists.pending],
      ['Preenchidos', summary.checklists.filled],
      ['Preenchidos em atraso', summary.checklists.filledLate],
      ['Itens a resolver', summary.checklists.issuesToResolve.length],
      [],
      ['Técnico', 'Categoria', 'Item', 'Resposta', 'Observação', 'Data'],
      ...summary.checklists.issuesToResolve.map((issue) => [issue.checklist.usuario.nome, issue.checklist.categoria, issue.template.pergunta, issue.valorBooleano === false ? 'Faltando' : 'Danificado', issue.valorTexto ?? '', new Date(issue.registradoEm).toLocaleString('pt-BR')]),
    ];
    downloadCsv('relatorio-checklists.csv', rows);
  }

  function exportRemovalReport() {
    if (!summary) return;
    downloadCsv('relatorio-remocoes.csv', [
      ['Relatório de Remoções', dateRangeLabel(from, to)],
      ['Remoções concluídas', summary.removals.completed],
      ['Remoções abertas/roteirizadas', summary.removals.open],
      ['Tentativas sem sucesso', summary.removals.failed],
      ['Rotas criadas', 'Em breve'],
    ]);
  }

  const checklistMetrics = summary ? [
    { label: 'Checklists pendentes', value: summary.checklists.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Checklists preenchidos', value: summary.checklists.filled, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Preenchidos em atraso', value: summary.checklists.filledLate, color: 'text-violet-700', bg: 'bg-violet-50' },
    { label: 'A resolver', value: summary.checklists.issuesToResolve.length, color: 'text-rose-700', bg: 'bg-rose-50' },
  ] : [];
  const removalMetrics = summary ? [
    { label: 'Remoções concluídas', value: summary.removals.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Remoções abertas', value: summary.removals.open, color: 'text-sky-700', bg: 'bg-sky-50' },
    { label: 'Tentativas sem sucesso', value: summary.removals.failed, color: 'text-rose-700', bg: 'bg-rose-50' },
  ] : [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="px-2 py-3"><h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Dashboard</h1></header>

      <section className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="text-sm font-medium text-slate-700">De<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Até<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <button type="button" onClick={() => { setFrom(''); setTo(''); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600">Período geral</button>
        <span className="pb-2 text-xs text-slate-500">{dateRangeLabel(from, to)}</span>
      </section>

      {message && <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</p>}
      {loading && <p className="px-3 text-sm text-slate-500">Atualizando indicadores...</p>}

      <section className="card p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Checklists</h2><p className="mt-1 text-sm text-slate-500">Pendências, preenchimentos e itens que precisam de atenção.</p></div><button type="button" disabled={!summary} onClick={exportChecklistReport} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Exportar relatório</button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{checklistMetrics.map((metric) => <article key={metric.label} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{metric.label}</p><p className={`mt-2 text-3xl font-bold ${metric.color}`}>{metric.value}</p></article>)}</div>
        <div className="mt-5"><h3 className="font-semibold text-slate-800">Itens a resolver</h3>{!summary || summary.checklists.issuesToResolve.length === 0 ? <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Nenhum item pendente de resolução.</p> : <div className="mt-3 space-y-3">{summary.checklists.issuesToResolve.map((issue) => <article key={issue.id} className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{issue.template.pergunta}</p><p className="mt-1 text-sm text-slate-600">{issue.checklist.categoria} · {issue.checklist.usuario.nome} · {issue.valorBooleano === false ? 'Faltando' : 'Danificado'}</p>{issue.valorTexto && <p className="mt-1 text-sm text-slate-700">{issue.valorTexto}</p>}</div><button type="button" disabled={resolvingId === issue.id} onClick={() => resolveIssue(issue)} className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{resolvingId === issue.id ? 'Salvando...' : 'Marcar resolvido'}</button></article>)}</div>}</div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Remoções</h2><p className="mt-1 text-sm text-slate-500">Resumo da fila e das tentativas de remoção.</p></div><button type="button" disabled={!summary} onClick={exportRemovalReport} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Exportar relatório</button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{removalMetrics.map((metric) => <article key={metric.label} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{metric.label}</p><p className={`mt-2 text-3xl font-bold ${metric.color}`}>{metric.value}</p></article>)}<article className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-sm text-slate-500">Rotas de remoção</p><p className="mt-2 text-lg font-bold text-slate-400">EM BREVE</p></article></div>
      </section>
    </main>
  );
}
