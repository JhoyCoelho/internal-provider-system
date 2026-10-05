'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Category = 'FERRAMENTAS' | 'VEICULO' | 'EPIS';
type Template = { id: string; categoria: string; pergunta: string; tipoResposta: 'OK' | 'NAO_CONFORME' | 'TEXTO' };
type Pending = { id: string; categoria: Category; status: 'PENDENTE' | 'EM_ATRASO' | 'PREENCHIDO' | 'APROVADO' | 'REPROVADO' | 'PENDENTE_APROVACAO'; dataPrevista: string | null; janela: 'INICIO_EXPEDIENTE' | 'FIM_EXPEDIENTE'; canFillNow: boolean; requiresJustification: boolean };
type Answer = { respostaTipo: 'OK' | 'NAO_CONFORME' | 'TEXTO'; valorTexto: string; valorBooleano: boolean | null };

type Screen = 'home' | 'justification' | 'checklist';

const categories: { key: Category; label: string }[] = [
  { key: 'FERRAMENTAS', label: 'Ferramentas' },
  { key: 'VEICULO', label: 'Veículo' },
  { key: 'EPIS', label: 'EPIs' },
];
const windowLabels = { INICIO_EXPEDIENTE: 'Início do expediente · 08:00–08:30', FIM_EXPEDIENTE: 'Fim do expediente · 17:30–18:15' };

function formatDate(value: string | null) {
  if (!value) return 'Não definida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function SignaturePad({ onChange }: { onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  }
  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <canvas ref={canvasRef} width={720} height={220} className="h-32 w-full touch-none" onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const point = position(event); const context = canvasRef.current!.getContext('2d')!; context.beginPath(); context.moveTo(point.x, point.y); }} onPointerMove={(event) => { if (!drawing.current) return; const context = canvasRef.current!.getContext('2d')!; const point = position(event); context.lineWidth = 3; context.lineCap = 'round'; context.strokeStyle = '#0f172a'; context.lineTo(point.x, point.y); context.stroke(); onChange(canvasRef.current!.toDataURL('image/png')); }} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs font-medium text-rose-600">Limpar assinatura</button>
    </div>
  );
}

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedPending, setSelectedPending] = useState<Pending | null>(null);
  const [lateChecklistId, setLateChecklistId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [justification, setJustification] = useState({ motivo: 'ESQUECIMENTO', descricao: '' });
  const [signature, setSignature] = useState('');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now] = useState(() => new Date().toISOString());

  async function loadData() {
    setLoading(true);
    try {
      const [templateData, pendingData] = await Promise.all([
        apiFetch<Template[]>('/api/checklists/templates'),
        apiFetch<Pending[]>('/api/checklists/pendentes/me'),
      ]);
      setTemplates(templateData);
      setPending(pendingData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os checklists.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const actionablePending = pending.filter((slot) => slot.canFillNow || slot.requiresJustification);
  const selectedTemplates = templates.filter((template) => template.categoria === selectedCategory);
  const selectedLabel = categories.find((category) => category.key === selectedCategory)?.label ?? 'Checklist';

  function resetForm() {
    setAnswers({}); setSignature(''); setObservations(''); setMessage(null);
  }

  function openCategory(category: Category) {
    resetForm(); setSelectedCategory(category); setLateChecklistId(null); setScreen('checklist');
  }

  function openChecklistSlot(slot: Pending) {
    setSelectedPending(slot);
    setSelectedCategory(slot.categoria);
    setLateChecklistId(slot.id);
    setMessage(null);
    resetForm();
    if (slot.requiresJustification) {
      setJustification({ motivo: 'ESQUECIMENTO', descricao: '' });
      setScreen('justification');
      return;
    }
    setScreen('checklist');
  }

  async function submitJustification() {
    if (!selectedPending || !signature || justification.descricao.trim().length < 5) {
      setMessage('Informe o motivo, a descrição e a assinatura.'); return;
    }
    setSubmitting(true); setMessage(null);
    try {
      await apiFetch('/api/checklists/submit-late', { method: 'POST', body: JSON.stringify({ checklistId: selectedPending.id, motivo: justification.motivo, descricao: justification.descricao, assinaturaData: signature }) });
      resetForm(); setScreen('checklist');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a justificativa.'); } finally { setSubmitting(false); }
  }

  async function submitChecklist() {
    if (selectedTemplates.some((template) => !answers[template.id]) || !signature) { setMessage('Preencha os itens e registre a assinatura.'); return; }
    if (selectedTemplates.some((template) => answers[template.id].respostaTipo === 'NAO_CONFORME' && !answers[template.id].valorTexto.trim())) { setMessage('Descreva os itens faltantes ou danificados.'); return; }
    setSubmitting(true); setMessage(null);
    try {
      const payload = { checklistId: lateChecklistId ?? undefined, categoria: selectedCategory, assinaturaData: signature, answers: selectedTemplates.map((template) => ({ templateId: template.id, respostaTipo: answers[template.id].respostaTipo, valorTexto: answers[template.id].valorTexto || observations || null, valorBooleano: answers[template.id].valorBooleano, itemCritico: false })) };
      await apiFetch('/api/checklists/submit', { method: 'POST', body: JSON.stringify(payload) });
      await loadData(); resetForm(); setLateChecklistId(null); setSelectedCategory(null); setScreen('home'); setMessage('Checklist enviado com sucesso.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o checklist.'); } finally { setSubmitting(false); }
  }

  if (loading) return <main className="mx-auto max-w-2xl p-4 text-sm text-slate-500">Carregando checklists...</main>;

  if (screen === 'justification' && selectedPending) {
    return (
      <main className="mx-auto max-w-2xl pb-6">
        <section className="card p-5">
          <button type="button" onClick={() => setScreen('home')} className="mb-4 text-sm text-brand-600">Voltar ao checklist</button>
          <h1 className="text-xl font-semibold text-slate-900">Registro de justificativa</h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">Preencha a justificativa para liberar o checklist pendente.</p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Checklist pendente</dt><dd className="font-medium text-slate-900">{categories.find((category) => category.key === selectedPending.categoria)?.label} · {windowLabels[selectedPending.janela]}</dd></div>
            <div><dt className="text-xs text-slate-500">Deveria ser preenchido em</dt><dd className="font-medium text-slate-900">{formatDate(selectedPending.dataPrevista)}</dd></div>
            <div><dt className="text-xs text-slate-500">Preenchimento atual</dt><dd className="font-medium text-slate-900">{formatDate(now)}</dd></div>
          </dl>
          <label className="mt-5 block text-sm font-medium text-slate-800" htmlFor="reason">Motivo</label>
          <select id="reason" value={justification.motivo} onChange={(event) => setJustification((current) => ({ ...current, motivo: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"><option value="ESQUECIMENTO">Esquecimento</option><option value="FALHA_SISTEMA">Falha no sistema</option><option value="OUTROS">Outros</option></select>
          <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="description">Descrição</label>
          <textarea id="description" value={justification.descricao} onChange={(event) => setJustification((current) => ({ ...current, descricao: event.target.value }))} className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Descreva o motivo..." />
          <p className="mb-2 mt-4 text-sm font-medium text-slate-800">Assinatura do colaborador</p>
          <SignaturePad onChange={setSignature} />
          {message && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
          <button type="button" disabled={submitting} onClick={submitJustification} className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{submitting ? 'Enviando...' : 'Enviar justificativa'}</button>
        </section>
      </main>
    );
  }

  if (screen === 'checklist' && selectedCategory) {
    return (
      <main className="mx-auto max-w-2xl pb-6">
        <header className="mb-4 px-2 py-3"><button type="button" onClick={() => setScreen('home')} className="mb-2 text-sm text-brand-600">Voltar aos checklists</button><h1 className="text-2xl font-bold text-slate-900">{selectedLabel}</h1><p className="mt-1 text-xs text-slate-500">Preenchimento registrado automaticamente em {formatDate(now)}</p></header>
        {lateChecklistId && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Preenchendo checklist pendente.</p>}
        <section className="space-y-3">{selectedTemplates.map((template) => { const answer = answers[template.id]; const needsObservation = answer?.respostaTipo === 'NAO_CONFORME'; return <article key={template.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-slate-800">{template.pergunta}</h2>{selectedCategory === 'VEICULO' ? <div className="mt-3 flex gap-2"><button type="button" onClick={() => setAnswers((current) => ({ ...current, [template.id]: { respostaTipo: 'OK', valorTexto: '', valorBooleano: true } }))} className={`rounded px-3 py-1.5 text-xs font-semibold ${answer?.respostaTipo === 'OK' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Sim</button><button type="button" onClick={() => setAnswers((current) => ({ ...current, [template.id]: { respostaTipo: 'NAO_CONFORME', valorTexto: answer?.valorTexto ?? '', valorBooleano: false } }))} className={`rounded px-3 py-1.5 text-xs font-semibold ${needsObservation ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Não</button></div> : <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setAnswers((current) => ({ ...current, [template.id]: { respostaTipo: 'OK', valorTexto: '', valorBooleano: true } }))} className={`rounded px-3 py-1.5 text-xs font-semibold ${answer?.respostaTipo === 'OK' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>OK</button><button type="button" onClick={() => setAnswers((current) => ({ ...current, [template.id]: { respostaTipo: 'NAO_CONFORME', valorTexto: answer?.valorTexto ?? '', valorBooleano: false } }))} className={`rounded px-3 py-1.5 text-xs font-semibold ${answer?.respostaTipo === 'NAO_CONFORME' && answer.valorBooleano === false ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>Faltando</button><button type="button" onClick={() => setAnswers((current) => ({ ...current, [template.id]: { respostaTipo: 'NAO_CONFORME', valorTexto: answer?.valorTexto ?? '', valorBooleano: null } }))} className={`rounded px-3 py-1.5 text-xs font-semibold ${answer?.respostaTipo === 'NAO_CONFORME' && answer.valorBooleano === null ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Danificado</button></div>}{needsObservation && <textarea value={answer.valorTexto} onChange={(event) => setAnswers((current) => ({ ...current, [template.id]: { ...current[template.id], valorTexto: event.target.value } }))} className="mt-3 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Descreva o problema..." />}</article>; })}</section>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-sm font-medium text-slate-800" htmlFor="observations">Observações gerais</label><textarea id="observations" value={observations} onChange={(event) => setObservations(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Digite uma observação..." /><p className="mb-2 mt-4 text-sm font-medium text-slate-800">Assinatura</p><SignaturePad onChange={setSignature} /></section>
        {message && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}<button type="button" disabled={submitting} onClick={submitChecklist} className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{submitting ? 'Enviando...' : 'Enviar checklist'}</button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 pb-6">
      <header className="px-2 py-3"><h1 className="text-2xl font-bold text-slate-900">Checklist Técnico</h1></header>
      <section className="card p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklists Pendentes</p><p className="mt-1 text-4xl font-bold text-slate-900">{actionablePending.length}</p></div>{actionablePending.length ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Preencha cada checklist no horário indicado. Os horários vencidos precisam de justificativa.</p> : <p className="mt-4 text-sm text-slate-600">Nenhum checklist pendente neste momento.</p>}</section>
      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {categories.map((category) => {
        const slots = pending.filter((slot) => slot.categoria === category.key);
        return <section key={category.key} className="card space-y-3 p-5"><div><h2 className="text-xl font-semibold text-slate-900">{category.label}</h2><p className="mt-1 text-sm text-slate-500">Duas conferências diárias</p></div>{slots.map((slot) => {
          const done = ['PREENCHIDO', 'APROVADO', 'REPROVADO'].includes(slot.status);
          const actionLabel = done ? 'Preenchido' : slot.requiresJustification ? 'Justificar atraso' : slot.canFillNow ? (slot.status === 'EM_ATRASO' ? 'Continuar preenchimento' : 'Preencher') : slot.status === 'PENDENTE_APROVACAO' ? 'Aguardando aprovação' : 'Aguardando horário';
          return <div key={slot.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-800">{windowLabels[slot.janela]}</p><p className="text-xs text-slate-500">Previsto: {formatDate(slot.dataPrevista)}</p></div><button type="button" disabled={!slot.canFillNow && !slot.requiresJustification} onClick={() => openChecklistSlot(slot)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{actionLabel}</button></div>;
        })}</section>;
      })}
    </main>
  );
}
