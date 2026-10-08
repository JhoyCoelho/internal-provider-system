'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { usePlatformTheme } from '../../providers/platform-theme-provider';

type Category = 'FERRAMENTAS' | 'VEICULO' | 'EPIS';
type Template = { id: string; categoria: string; pergunta: string; tipoResposta: 'OK' | 'NAO_CONFORME' | 'TEXTO' };
type Pending = { id: string; categoria: Category; status: 'PENDENTE' | 'EM_ATRASO' | 'PREENCHIDO' | 'APROVADO' | 'REPROVADO' | 'PENDENTE_APROVACAO'; dataPrevista: string | null; janela: 'INICIO_EXPEDIENTE' | 'FIM_EXPEDIENTE'; canFillNow: boolean; requiresJustification: boolean };
type Answer = { respostaTipo: 'OK' | 'NAO_CONFORME' | 'TEXTO'; valorTexto: string; valorBooleano: boolean | null };
type ResponsibilityTerm = {
  id: string;
  descricao: string;
  criadoPorNome: string;
  usuarioDesignadoNome: string;
  usuarioDesignadoEmail: string;
  assinaturaData: string | null;
  assinadoEm: string | null;
  createdAt: string;
};
type TermRecipient = { id: string; nome: string; email: string; role: string; status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO' };
type ChecklistRecord = {
  id: string;
  categoria: string;
  janela: 'INICIO_EXPEDIENTE' | 'FIM_EXPEDIENTE' | null;
  dataAgenda: string | null;
  dataPrevista: string | null;
  dataPreenchimento: string | null;
  status: 'PENDENTE' | 'PREENCHIDO' | 'EM_ATRASO' | 'PENDENTE_APROVACAO' | 'APROVADO' | 'REPROVADO';
  requiresJustification?: boolean;
  justificativaAtraso: string | null;
  assinaturaData: string | null;
  createdAt: string;
  usuarioNome?: string | null;
  usuario?: { id: string; nome: string; email: string };
  respostas: { id: string; respostaTipo: 'OK' | 'NAO_CONFORME' | 'TEXTO'; valorTexto: string | null; valorBooleano: boolean | null; itemCritico: boolean; template: { id: string; pergunta: string; tipoResposta: 'OK' | 'NAO_CONFORME' | 'TEXTO'; categoria: string } }[];
};

type Screen = 'home' | 'justification' | 'checklist';

const categories: { key: Category; label: string }[] = [
  { key: 'FERRAMENTAS', label: 'Ferramentas' },
  { key: 'VEICULO', label: 'Veículo' },
  { key: 'EPIS', label: 'EPIs' },
];
const windowLabels = { INICIO_EXPEDIENTE: 'Início do expediente · 08:00–08:30', FIM_EXPEDIENTE: 'Fim do expediente · 17:45–18:30' };

function formatDate(value: string | null) {
  if (!value) return 'Não definida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function checklistCategoryLabel(value: string) {
  return categories.find((category) => category.key === value)?.label ?? value;
}

function checklistStatusLabel(value: ChecklistRecord['status']) {
  return ({ PENDENTE: 'Pendente', PREENCHIDO: 'Preenchido', EM_ATRASO: 'Em atraso', PENDENTE_APROVACAO: 'Aguardando aprovação', APROVADO: 'Aprovado', REPROVADO: 'Reprovado' })[value];
}

function checklistAnswerStatus(record: ChecklistRecord, answer: ChecklistRecord['respostas'][number]) {
  if (answer.respostaTipo === 'OK') return record.categoria === 'VEICULO' ? 'SIM' : 'OK';
  if (record.categoria === 'VEICULO') return 'NÃO';
  if (answer.valorBooleano === false) return 'FALTANDO';
  if (answer.valorBooleano === true) return 'DANIFICADO';
  return 'NÃO CONFORME';
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

function ResponsibilityTermCard({ term, onSigned }: { term: ResponsibilityTerm; onSigned: (term: ResponsibilityTerm) => void }) {
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signTerm() {
    if (!signature) return;
    setSubmitting(true);
    setError(null);
    try {
      const signed = await apiFetch<ResponsibilityTerm>(`/api/checklists/termos/${term.id}/assinar`, {
        method: 'POST',
        body: JSON.stringify({ assinaturaData: signature }),
      });
      window.dispatchEvent(new Event('responsibility-terms-updated'));
      onSigned(signed);
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : 'Não foi possível registrar a assinatura.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase text-amber-800">Termo de responsabilidade pendente</p><p className="mt-1 text-xs text-slate-500">Emitido por {term.criadoPorNome} · {formatDate(term.createdAt)}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Assinatura necessária</span></div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">{term.descricao}</p>
      <p className="mt-4 text-sm font-medium text-slate-800">Assinatura do responsável</p>
      <SignaturePad onChange={setSignature} />
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      <button type="button" disabled={!signature || submitting} onClick={() => void signTerm()} className="mt-3 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Registrando...' : 'Confirmar e assinar'}</button>
    </article>
  );
}

function ResponsibilityTerms({ terms, onSigned }: { terms: ResponsibilityTerm[]; onSigned: (term: ResponsibilityTerm) => void }) {
  const pendingTerms = terms.filter((term) => !term.assinadoEm);
  if (!pendingTerms.length) return null;
  return (
    <section className="card space-y-3 border-amber-300 p-5">
      <div><h2 className="text-lg font-semibold text-slate-900">Termos de responsabilidade</h2><p className="mt-1 text-sm text-amber-800">Há {pendingTerms.length} termo(s) aguardando sua assinatura.</p></div>
      {pendingTerms.map((term) => <ResponsibilityTermCard key={term.id} term={term} onSigned={onSigned} />)}
    </section>
  );
}

function ChecklistPrintSheet({ record, technicianName, providerName, logoDataUrl }: { record: ChecklistRecord; technicianName: string; providerName: string; logoDataUrl: string | null }) {
  const filledAt = record.dataPreenchimento ?? record.createdAt;
  return (
    <article className="checklist-print-sheet">
      <header className="checklist-print-header">
        <div className="checklist-print-brand">{logoDataUrl
          ? <Image src={logoDataUrl} alt={`Logo ${providerName}`} width={200} height={54} unoptimized className="checklist-print-logo" />
          : providerName}</div>
        <h1>CHECKLIST TÉCNICO</h1>
      </header>
      <section className="checklist-print-meta">
        <p><b>Técnico:</b> {technicianName}</p>
        <p><b>Data:</b> {formatDate(filledAt)}</p>
        <p><b>Tipo:</b> {checklistCategoryLabel(record.categoria)}</p>
        <p><b>Destino:</b> Gestão / Supervisão</p>
      </section>
      {record.justificativaAtraso && <p className="checklist-print-justification"><b>Justificativa:</b> {record.justificativaAtraso}</p>}
      <table className="checklist-print-table">
        <thead><tr><th>Item</th><th>Status</th><th>Observação</th></tr></thead>
        <tbody>{record.respostas.map((answer, index) => {
          const status = checklistAnswerStatus(record, answer);
          const statusClass = status === 'OK' || status === 'SIM' ? 'is-ok' : status === 'DANIFICADO' || status === 'NÃO' ? 'is-damaged' : status === 'FALTANDO' ? 'is-missing' : 'is-text';
          return <tr key={answer.id}><td>{index + 1} - {answer.template.pergunta}</td><td><span className={`checklist-print-badge ${statusClass}`}>{status}</span></td><td>{answer.valorTexto?.trim() || '-'}</td></tr>;
        })}</tbody>
      </table>
      <section className="checklist-print-signature">
        <h2>Assinatura do Técnico</h2>
        {record.assinaturaData ? <img src={record.assinaturaData} alt={`Assinatura de ${technicianName}`} /> : <div className="checklist-print-signature-empty">Sem assinatura registrada</div>}
      </section>
      <footer>Documento gerado sob demanda pelo sistema {providerName}. Nenhum PDF é armazenado.</footer>
    </article>
  );
}

export default function ChecklistsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { theme } = usePlatformTheme();
  const isTechnician = Boolean(user?.roles.includes('TECNICO'));
  const isMasterAdmin = Boolean(user?.roles.includes('MASTER_ADMIN'));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [history, setHistory] = useState<ChecklistRecord[]>([]);
  const [teamRecords, setTeamRecords] = useState<ChecklistRecord[]>([]);
  const [terms, setTerms] = useState<ResponsibilityTerm[]>([]);
  const [issuedTerms, setIssuedTerms] = useState<ResponsibilityTerm[]>([]);
  const [termRecipients, setTermRecipients] = useState<TermRecipient[]>([]);
  const [termDescription, setTermDescription] = useState('');
  const [termRecipientId, setTermRecipientId] = useState('');
  const [issuingTerm, setIssuingTerm] = useState(false);
  const [deletingChecklistId, setDeletingChecklistId] = useState<string | null>(null);
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
  const [printRecord, setPrintRecord] = useState<ChecklistRecord | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [templateData, pendingData, historyData, assignedTerms] = await Promise.all([
        apiFetch<Template[]>('/api/checklists/templates'),
        apiFetch<Pending[]>('/api/checklists/pendentes/me'),
        apiFetch<ChecklistRecord[]>('/api/checklists/me'),
        apiFetch<ResponsibilityTerm[]>('/api/checklists/termos/me'),
      ]);
      setTemplates(templateData);
      setPending(pendingData);
      setHistory(historyData);
      setTerms(assignedTerms);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os checklists.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMasterDashboard() {
    setLoading(true);
    try {
      const [records, assignedTerms, issuedTermsData, recipients] = await Promise.all([
        apiFetch<ChecklistRecord[]>('/api/checklists/relatorio'),
        apiFetch<ResponsibilityTerm[]>('/api/checklists/termos/me'),
        apiFetch<ResponsibilityTerm[]>('/api/checklists/termos/emitidos'),
        apiFetch<TermRecipient[]>('/api/admin/users'),
      ]);
      setTeamRecords(records);
      setTerms(assignedTerms);
      setIssuedTerms(issuedTermsData);
      setTermRecipients(recipients);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o resumo dos checklists.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTermsOnly() {
    setLoading(true);
    try {
      setTerms(await apiFetch<ResponsibilityTerm[]>('/api/checklists/termos/me'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar seus termos.');
    } finally {
      setLoading(false);
    }
  }

  async function issueTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termRecipientId || termDescription.trim().length < 5) {
      setMessage('Selecione um responsável e descreva o termo.');
      return;
    }
    setIssuingTerm(true);
    setMessage(null);
    try {
      const created = await apiFetch<ResponsibilityTerm>('/api/checklists/termos', {
        method: 'POST',
        body: JSON.stringify({ usuarioDesignadoId: termRecipientId, descricao: termDescription.trim() }),
      });
      setIssuedTerms((current) => [created, ...current]);
      setTermDescription('');
      setTermRecipientId('');
      setMessage(`Termo enviado para ${created.usuarioDesignadoNome}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível emitir o termo.');
    } finally {
      setIssuingTerm(false);
    }
  }

  async function removePendingChecklist(record: ChecklistRecord) {
    if (!window.confirm(`Excluir a pendência de ${record.usuario?.nome ?? 'este usuário'}? Esta ação não pode ser desfeita.`)) return;
    setDeletingChecklistId(record.id);
    setMessage(null);
    try {
      await apiFetch(`/api/checklists/${record.id}`, { method: 'DELETE' });
      setTeamRecords((current) => current.filter((item) => item.id !== record.id));
      setMessage('Pendência de checklist excluída.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a pendência.');
    } finally {
      setDeletingChecklistId(null);
    }
  }

  useEffect(() => {
    if (isTechnician) void loadData();
    else if (isMasterAdmin) void loadMasterDashboard();
    else void loadTermsOnly();
  }, [isTechnician, isMasterAdmin]);
  useEffect(() => {
    if (!printRecord) return;
    const previousTitle = document.title;
    document.title = `Checklist-${checklistCategoryLabel(printRecord.categoria)}`;
    const timer = window.setTimeout(() => window.print(), 150);
    const clearPrintRecord = () => {
      document.title = previousTitle;
      setPrintRecord(null);
    };
    window.addEventListener('afterprint', clearPrintRecord);
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', clearPrintRecord); document.title = previousTitle; };
  }, [printRecord]);

  const actionablePending = pending.filter((slot) => slot.canFillNow || slot.requiresJustification);
  const selectedTemplates = templates.filter((template) => template.categoria === selectedCategory);
  const selectedLabel = categories.find((category) => category.key === selectedCategory)?.label ?? 'Checklist';
  const masterPendingRecords = teamRecords.filter((record) => ['PENDENTE', 'EM_ATRASO', 'PENDENTE_APROVACAO'].includes(record.status));
  const masterLateRecords = masterPendingRecords.filter((record) => record.requiresJustification || ['EM_ATRASO', 'PENDENTE_APROVACAO'].includes(record.status));
  const masterCorrectRecords = teamRecords.filter((record) =>
    ['PREENCHIDO', 'APROVADO'].includes(record.status)
    && !record.respostas.some((answer) => answer.respostaTipo === 'NAO_CONFORME'));
  const assignableTermRecipients = termRecipients.filter((recipient) => recipient.id !== user?.id);

  function updateSignedTerm(signedTerm: ResponsibilityTerm) {
    setTerms((current) => current.map((term) => term.id === signedTerm.id ? signedTerm : term));
    setMessage('Termo de responsabilidade assinado.');
  }

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

  if (authLoading || loading) return <main className="mx-auto max-w-2xl p-4 text-sm text-slate-500">Carregando checklists...</main>;
  if (!isTechnician && !isMasterAdmin) return (
    <main className="mx-auto max-w-3xl space-y-4 pb-6">
      <ResponsibilityTerms terms={terms} onSigned={updateSignedTerm} />
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {!terms.some((term) => !term.assinadoEm) && <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">Acesso restrito. Você não possui termos de responsabilidade pendentes.</p>}
    </main>
  );

  if (isMasterAdmin) return (
    <main className="mx-auto max-w-5xl space-y-4 pb-6">
      <header className="px-2 py-3"><h1 className="text-2xl font-bold text-slate-900">Resumo de checklists</h1><p className="mt-1 text-sm text-slate-500">Pendências da equipe e checklists preenchidos sem não conformidades.</p></header>
      {message && <p role="status" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>}
      <ResponsibilityTerms terms={terms} onSigned={updateSignedTerm} />
      <section className="card space-y-3 p-5"><div><h2 className="text-lg font-semibold text-slate-900">Emitir termo de responsabilidade</h2><p className="mt-1 text-sm text-slate-500">O usuário designado receberá o documento na fila de Checklists.</p></div><form onSubmit={issueTerm} className="grid gap-3"><label className="text-sm font-medium text-slate-700">Responsável<select required value={termRecipientId} onChange={(event) => setTermRecipientId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Selecione um usuário</option>{assignableTermRecipients.map((recipient) => <option key={recipient.id} value={recipient.id} disabled={recipient.status !== 'ATIVO'}>{recipient.nome} · {recipient.email}{recipient.status !== 'ATIVO' ? ` (${recipient.status.toLowerCase()})` : ''}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Atividade ou responsabilidade<textarea required minLength={5} maxLength={20000} value={termDescription} onChange={(event) => setTermDescription(event.target.value)} className="mt-1 min-h-32 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label><button type="submit" disabled={issuingTerm || !assignableTermRecipients.some((recipient) => recipient.status === 'ATIVO')} className="justify-self-start rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{issuingTerm ? 'Emitindo...' : 'Emitir termo'}</button></form>{issuedTerms.length > 0 && <div className="space-y-2 border-t border-slate-200 pt-3"><h3 className="text-sm font-semibold text-slate-800">Termos emitidos</h3>{issuedTerms.slice(0, 10).map((term) => <p key={term.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{term.usuarioDesignadoNome} · {term.assinadoEm ? `Assinado em ${formatDate(term.assinadoEm)}` : 'Aguardando assinatura'} · {formatDate(term.createdAt)}</p>)}</div>}</section>
      {masterPendingRecords.length || masterCorrectRecords.length ? <>
        <div className="grid gap-3 sm:grid-cols-3"><article className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-800">Pendentes</p><p className="mt-1 text-3xl font-bold text-amber-900">{masterPendingRecords.length - masterLateRecords.length}</p></article><article className="rounded-lg border border-rose-200 bg-rose-50 p-4"><p className="text-sm text-rose-800">Atrasados</p><p className="mt-1 text-3xl font-bold text-rose-900">{masterLateRecords.length}</p></article><article className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Preenchidos corretamente</p><p className="mt-1 text-3xl font-bold text-emerald-900">{masterCorrectRecords.length}</p></article></div>
        {masterPendingRecords.length > 0 && <section className="card space-y-3 p-5"><h2 className="text-lg font-semibold text-slate-900">Pendências da equipe</h2><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ação</th></tr></thead><tbody>{masterPendingRecords.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-medium text-slate-800">{record.usuario?.nome ?? record.usuarioNome ?? 'Usuário removido'}</td><td className="px-3 py-2">{checklistCategoryLabel(record.categoria)}</td><td className="px-3 py-2">{record.janela ? windowLabels[record.janela] : 'Avulso'} · {formatDate(record.dataPrevista)}</td><td className="px-3 py-2">{record.requiresJustification ? 'Atrasado' : checklistStatusLabel(record.status)}</td><td className="px-3 py-2"><button type="button" disabled={deletingChecklistId === record.id} onClick={() => void removePendingChecklist(record)} className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-50">{deletingChecklistId === record.id ? 'Excluindo...' : 'Excluir pendência'}</button></td></tr>)}</tbody></table></div></section>}
        {masterCorrectRecords.length > 0 && <section className="card space-y-3 p-5"><h2 className="text-lg font-semibold text-slate-900">Preenchidos corretamente</h2><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ação</th></tr></thead><tbody>{masterCorrectRecords.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-medium text-slate-800">{record.usuario?.nome ?? record.usuarioNome ?? 'Usuário removido'}</td><td className="px-3 py-2">{checklistCategoryLabel(record.categoria)}</td><td className="px-3 py-2">{formatDate(record.dataPreenchimento)}</td><td className="px-3 py-2">{checklistStatusLabel(record.status)}</td><td className="px-3 py-2"><button type="button" onClick={() => setPrintRecord(record)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">Imprimir</button></td></tr>)}</tbody></table></div></section>}
      </> : <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">Não há checklists pendentes ou preenchidos corretamente.</p>}
      {printRecord && <ChecklistPrintSheet record={printRecord} technicianName={printRecord.usuario?.nome ?? 'Colaborador'} providerName={theme.providerName} logoDataUrl={theme.logoDataUrl} />}
    </main>
  );

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
    <main className="mx-auto max-w-6xl space-y-4 pb-6">
      <header className="px-2 py-3"><h1 className="text-2xl font-bold text-slate-900">Checklist Técnico</h1></header>
      <ResponsibilityTerms terms={terms} onSigned={updateSignedTerm} />
      <section className="card p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklists Pendentes</p><p className="mt-1 text-4xl font-bold text-slate-900">{actionablePending.length}</p></div>{actionablePending.length ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Preencha cada checklist no horário indicado. Os horários vencidos precisam de justificativa.</p> : <p className="mt-4 text-sm text-slate-600">Nenhum checklist pendente neste momento.</p>}</section>
      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      <section className="card space-y-3 p-5"><div><h2 className="text-lg font-semibold text-slate-900">Meu histórico individual</h2><p className="mt-1 text-sm text-slate-500">Seus registros de ferramentas, veículo e EPIs.</p></div>{history.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Janela</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th></tr></thead><tbody>{history.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2">{checklistCategoryLabel(record.categoria)}</td><td className="px-3 py-2">{formatDate(record.dataPreenchimento ?? record.dataPrevista)}</td><td className="px-3 py-2">{record.janela ? windowLabels[record.janela] : 'Extra'}</td><td className="px-3 py-2">{checklistStatusLabel(record.status)}</td><td className="px-3 py-2">{['PREENCHIDO', 'APROVADO', 'REPROVADO'].includes(record.status) ? <button type="button" onClick={() => setPrintRecord(record)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">Imprimir</button> : <span className="text-xs text-slate-400">Indisponível</span>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">Nenhum checklist registrado ainda.</p>}</section>
      {categories.map((category) => {
        const slots = pending.filter((slot) => slot.categoria === category.key);
        return <section key={category.key} className="card space-y-3 p-5"><div><h2 className="text-xl font-semibold text-slate-900">{category.label}</h2><p className="mt-1 text-sm text-slate-500">Duas conferências diárias</p></div>{slots.map((slot) => {
          const done = ['PREENCHIDO', 'APROVADO', 'REPROVADO'].includes(slot.status);
          const actionLabel = done ? 'Preenchido' : slot.requiresJustification ? 'Justificar atraso' : slot.canFillNow ? (slot.status === 'EM_ATRASO' ? 'Continuar preenchimento' : 'Preencher') : slot.status === 'PENDENTE_APROVACAO' ? 'Aguardando aprovação' : 'Aguardando horário';
          return <div key={slot.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-800">{windowLabels[slot.janela]}</p><p className="text-xs text-slate-500">Previsto: {formatDate(slot.dataPrevista)}</p></div><button type="button" disabled={!slot.canFillNow && !slot.requiresJustification} onClick={() => openChecklistSlot(slot)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{actionLabel}</button></div>;
        })}</section>;
      })}
      {printRecord && <ChecklistPrintSheet record={printRecord} technicianName={printRecord.usuario?.nome ?? user?.nome ?? 'Colaborador'} providerName={theme.providerName} logoDataUrl={theme.logoDataUrl} />}
    </main>
  );
}
