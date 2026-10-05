'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { LocationPicker } from './location-picker';

type Status = 'ABERTO' | 'ROTEIRIZADO' | 'CONCLUIDO' | 'FALHA_TENTATIVA';
type Observation = { id: string; texto: string; createdAt: string; usuario: { nome: string } };
type Order = { id: string; clienteNome: string; endereco: string; numero: string; bairro: string; pontoReferencia: string; localizacao: string; equipamentoSerial: string | null; telefoneContato: string | null; status: Status; createdAt: string; observacoes: Observation[] };
type FilterField = 'clienteNome' | 'endereco' | 'numero' | 'bairro' | 'pontoReferencia';

const labels: Record<Status, string> = { ABERTO: 'Aberto', ROTEIRIZADO: 'Roteirizado', CONCLUIDO: 'Concluído', FALHA_TENTATIVA: 'Falha na tentativa' };
const styles: Record<Status, string> = { ABERTO: 'bg-sky-100 text-sky-700', ROTEIRIZADO: 'bg-amber-100 text-amber-700', CONCLUIDO: 'bg-emerald-100 text-emerald-700', FALHA_TENTATIVA: 'bg-rose-100 text-rose-700' };
const emptyForm = { clienteNome: '', endereco: '', numero: '', bairro: '', pontoReferencia: '', localizacao: '', equipamentoSerial: '', telefoneContato: '', fotoFachadaUrl: '' };

function fileToDataUrl(event: ChangeEvent<HTMLInputElement>, setValue: (value: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    const maxDimension = 1920;
    const maxBytes = 3 * 1024 * 1024;
    let scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let quality = 0.86;
    let blob: Blob | null = null;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      window.alert('Não foi possível processar a imagem. Tente outro arquivo.');
      return;
    }

    const encode = (nextScale: number, nextQuality: number) => new Promise<Blob | null>((resolve) => {
      canvas.width = Math.round(image.naturalWidth * nextScale);
      canvas.height = Math.round(image.naturalHeight * nextScale);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', nextQuality);
    });

    void (async () => {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        blob = await encode(scale, quality);
        if (blob && blob.size <= maxBytes) break;
        if (quality > 0.58) quality -= 0.08;
        else scale *= 0.8;
      }

      if (!blob || blob.size > maxBytes) {
        window.alert('A imagem é muito grande para ser enviada. Escolha uma imagem menor.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => setValue(String(reader.result));
      reader.onerror = () => window.alert('Não foi possível ler a imagem selecionada.');
      reader.readAsDataURL(blob);
    })();
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    window.alert('Não foi possível abrir esta imagem. Selecione uma foto JPG, PNG ou WebP.');
  };
  image.src = imageUrl;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}${digits.length > 7 ? `-${digits.slice(7)}` : ''}`;
}

export default function RemocaoPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions.includes('ORDERS_WRITE'));
  const canChangeStatus = Boolean(user?.permissions.includes('ORDERS_STATUS_WRITE'));
  const canAddNote = Boolean(user?.permissions.includes('ORDERS_NOTE_WRITE'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filterField, setFilterField] = useState<FilterField>('clienteNome');
  const [filterValue, setFilterValue] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingRemoval, setSavingRemoval] = useState(false);

  async function loadOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterValue) params.set(filterField, filterValue);
      if (status) params.set('status', status);
      setOrders(await apiFetch<Order[]>(`/api/ordens-remocao${params.toString() ? `?${params}` : ''}`));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as remoções.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadOrders(); }, [filterField, filterValue, status]);

  async function createRemoval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (form.telefoneContato && form.telefoneContato.replace(/\D/g, '').length !== 11) { setFormError('O telefone deve conter 11 dígitos.'); return; }
    if (form.equipamentoSerial && !/^[A-Za-z0-9]{12}$/.test(form.equipamentoSerial)) { setFormError('O serial deve conter exatamente 12 caracteres alfanuméricos.'); return; }
    if (!form.localizacao) { setFormError('Marque a localização no mapa.'); return; }
    setSavingRemoval(true);
    try {
      await apiFetch('/api/ordens-remocao', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      setShowForm(false);
      setMessage('Remoção criada com sucesso.');
      await loadOrders();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível criar a remoção.');
    } finally {
      setSavingRemoval(false);
    }
  }

  async function updateStatus(nextStatus: Status) {
    if (!selected) return;
    if (!photo) { setMessage(nextStatus === 'CONCLUIDO' ? 'Anexe a foto do aparelho com o serial.' : 'Anexe a foto da fachada.'); return; }
    const body = { status: nextStatus, fotoSerialUrl: nextStatus === 'CONCLUIDO' ? photo : null, fotoFachadaUrl: nextStatus === 'FALHA_TENTATIVA' ? photo : null, substatusFalha: nextStatus === 'FALHA_TENTATIVA' ? 'CLIENTE_AUSENTE' : null };
    try { const updated = await apiFetch<Order>(`/api/ordens-remocao/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify(body) }); setSelected(updated); setPhoto(''); setMessage('Status atualizado.'); await loadOrders(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o status.'); }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    try { const created = await apiFetch<Observation>(`/api/ordens-remocao/${selected.id}/observacoes`, { method: 'POST', body: JSON.stringify({ texto: note }) }); setSelected({ ...selected, observacoes: [created, ...selected.observacoes] }); setNote(''); setMessage('Observação registrada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a observação.'); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 pb-6">
      <header className="flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Remoção</h1><p className="mt-1 text-sm text-slate-500">Fila geral de equipamentos para remoção.</p></div>{canManage && <button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">{showForm ? 'Fechar formulário' : 'Nova remoção'}</button>}</header>
      {showForm && <form onSubmit={createRemoval} className="card grid gap-3 p-5 sm:grid-cols-2"><h2 className="text-lg font-semibold sm:col-span-2">Dados da remoção</h2>{([['clienteNome', 'Nome completo do cliente'], ['endereco', 'Endereço'], ['numero', 'Número (digite S/N caso não tenha número)'], ['bairro', 'Bairro'], ['pontoReferencia', 'Ponto de referência']] as const).map(([field, label]) => <label key={field} className="text-sm font-medium text-slate-700">{label} <span className="text-rose-600">*</span><input required value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>)}<div className="sm:col-span-2"><p className="text-sm font-medium text-slate-700">Localização exata <span className="text-rose-600">*</span></p><div className="mt-1"><LocationPicker value={form.localizacao} onChange={(value) => setForm((current) => ({ ...current, localizacao: value }))} /></div></div><label className="text-sm font-medium text-slate-700">Serial do aparelho (opcional)<input inputMode="text" maxLength={12} value={form.equipamentoSerial} onChange={(event) => setForm((current) => ({ ...current, equipamentoSerial: event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="12 caracteres" />{form.equipamentoSerial && form.equipamentoSerial.length !== 12 && <span className="text-xs text-rose-600">O serial deve conter 12 caracteres alfanuméricos.</span>}</label><label className="text-sm font-medium text-slate-700">Número para contato (opcional)<input inputMode="tel" value={form.telefoneContato} onChange={(event) => setForm((current) => ({ ...current, telefoneContato: formatPhone(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="91 98533-4309" />{form.telefoneContato && form.telefoneContato.replace(/\D/g, '').length !== 11 && <span className="text-xs text-rose-600">Informe DDD e número com 11 dígitos.</span>}</label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Foto da fachada (opcional)<input type="file" accept="image/*" onChange={(event) => fileToDataUrl(event, (value) => setForm((current) => ({ ...current, fotoFachadaUrl: value })))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>{formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{formError}</p>}<button type="submit" className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white sm:col-span-2">Criar remoção</button></form>}
      <section className="card grid gap-3 p-4 sm:grid-cols-[180px_1fr_180px]"><select value={filterField} onChange={(event) => setFilterField(event.target.value as FilterField)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="clienteNome">Nome do cliente</option><option value="endereco">Endereço</option><option value="numero">Número</option><option value="bairro">Bairro</option><option value="pontoReferencia">Ponto de referência</option></select><input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Digite para filtrar" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Todos os status</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></section>
      {message && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm">{message}</p>}
      {loading ? <p className="p-4 text-sm text-slate-500">Carregando remoções...</p> : <section className="grid gap-3">{orders.map((order) => <article key={order.id} className="card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{order.clienteNome}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[order.status]}`}>{labels[order.status]}</span></div><p className="mt-2 text-sm text-slate-600">{order.endereco}, {order.numero} · {order.bairro}</p><p className="mt-1 text-xs text-slate-500">Referência: {order.pontoReferencia}</p></div><button type="button" onClick={() => { setSelected(order); setPhoto(''); setMessage(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Consultar ordem</button></div></article>)}</section>}
      {selected && <div className="fixed inset-0 z-10 overflow-y-auto bg-slate-950/40 p-4"><section className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Ordem de remoção</h2><p className="mt-1 text-sm text-slate-500">{selected.clienteNome} · {labels[selected.status]}</p></div><button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-500">Fechar</button></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Endereço</dt><dd>{selected.endereco}, {selected.numero}</dd></div><div><dt className="text-slate-500">Bairro</dt><dd>{selected.bairro}</dd></div><div><dt className="text-slate-500">Ponto de referência</dt><dd>{selected.pontoReferencia}</dd></div><div><dt className="text-slate-500">Serial</dt><dd>{selected.equipamentoSerial || 'Não informado'}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Localização</dt><dd><a className="font-medium text-brand-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.localizacao)}`}>Abrir no Google Maps</a></dd></div></dl>{canChangeStatus && selected.status !== 'CONCLUIDO' && <div className="mt-5 border-t border-slate-200 pt-4"><label className="text-sm font-medium">Foto obrigatória<input type="file" accept="image/*" onChange={(event) => fileToDataUrl(event, setPhoto)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => updateStatus('CONCLUIDO')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Concluir</button><button type="button" onClick={() => updateStatus('FALHA_TENTATIVA')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Falha na tentativa</button></div></div>}{canAddNote && <form onSubmit={addNote} className="mt-5 border-t border-slate-200 pt-4"><label className="text-sm font-medium">Nova observação<textarea required value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label><button className="mt-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Registrar observação</button></form>}<div className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">Histórico de observações</h3>{selected.observacoes.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhuma observação registrada.</p> : <div className="mt-3 space-y-3">{selected.observacoes.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm text-slate-800">{item.texto}</p><p className="mt-1 text-xs text-slate-500">{item.usuario.nome} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}</p></div>)}</div>}</div></section></div>}
    </main>
  );
}
