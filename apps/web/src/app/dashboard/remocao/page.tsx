'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../providers/auth-provider';
import { LocationPicker } from './location-picker';

type Status = 'ABERTO' | 'ROTEIRIZADO' | 'CONCLUIDO' | 'FALHA_TENTATIVA' | 'EM_OBSERVACAO';
type Observation = { id: string; texto: string; createdAt: string; usuario: { nome: string } };
type Order = {
  id: string;
  clienteNome: string;
  endereco: string;
  numero: string;
  bairro: string;
  pontoReferencia: string;
  localizacao: string;
  equipamentoSerial: string | null;
  telefoneContato: string | null;
  tentativasFalha: number;
  status: Status;
  createdAt: string;
  observacoes: Observation[];
};
type RouteStop = { id: string; sequencia: number; ordem: Pick<Order, 'id' | 'clienteNome' | 'endereco' | 'numero' | 'bairro' | 'pontoReferencia' | 'localizacao' | 'status'> };
type RoutePlan = { id: string; origem: string; distanciaKm: number; status: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'; createdAt: string; paradas: RouteStop[] };
type FilterField = 'clienteNome' | 'endereco' | 'numero' | 'bairro' | 'pontoReferencia';
type PhotoTarget = 'serial' | 'facade';

const labels: Record<Status, string> = { ABERTO: 'Aberto', ROTEIRIZADO: 'Roteirizado', CONCLUIDO: 'Concluído', FALHA_TENTATIVA: 'Falha na tentativa', EM_OBSERVACAO: 'Em observação' };
const styles: Record<Status, string> = { ABERTO: 'bg-sky-100 text-sky-700', ROTEIRIZADO: 'bg-amber-100 text-amber-700', CONCLUIDO: 'bg-emerald-100 text-emerald-700', FALHA_TENTATIVA: 'bg-rose-100 text-rose-700', EM_OBSERVACAO: 'bg-orange-100 text-orange-800' };
const emptyForm = { clienteNome: '', endereco: '', numero: '', bairro: '', pontoReferencia: '', localizacao: '', equipamentoSerial: '', telefoneContato: '', fotoFachadaUrl: '' };

function fileToDataUrl(event: ChangeEvent<HTMLInputElement>, setValue: (value: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    let scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    let quality = 0.86;
    let blob: Blob | null = null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) { window.alert('Não foi possível processar a imagem. Tente outro arquivo.'); return; }
    const encode = (nextScale: number, nextQuality: number) => new Promise<Blob | null>((resolve) => {
      canvas.width = Math.round(image.naturalWidth * nextScale);
      canvas.height = Math.round(image.naturalHeight * nextScale);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', nextQuality);
    });
    void (async () => {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        blob = await encode(scale, quality);
        if (blob && blob.size <= 3 * 1024 * 1024) break;
        if (quality > 0.58) quality -= 0.08;
        else scale *= 0.8;
      }
      if (!blob || blob.size > 3 * 1024 * 1024) { window.alert('A imagem é muito grande. Escolha uma imagem menor.'); return; }
      const reader = new FileReader();
      reader.onload = () => setValue(String(reader.result));
      reader.onerror = () => window.alert('Não foi possível ler a imagem selecionada.');
      reader.readAsDataURL(blob);
    })();
  };
  image.onerror = () => { URL.revokeObjectURL(imageUrl); window.alert('Não foi possível abrir esta imagem. Selecione uma foto JPG, PNG ou WebP.'); };
  image.src = imageUrl;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}${digits.length > 7 ? `-${digits.slice(7)}` : ''}`;
}

function mapLegUrl(origin: string, destination: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export default function RemocaoPage() {
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions.includes('ORDERS_WRITE'));
  const canChangeStatus = Boolean(user?.permissions.includes('ORDERS_STATUS_WRITE'));
  const canAddNote = Boolean(user?.permissions.includes('ORDERS_NOTE_WRITE'));
  const canCreateRoute = canManage || canChangeStatus;
  const canDeleteOrder = Boolean(user?.roles.includes('MASTER_ADMIN'));
  const canCancelRoute = Boolean(user?.roles.some((role) => role === 'ADMIN' || role === 'MASTER_ADMIN'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filterField, setFilterField] = useState<FilterField>('clienteNome');
  const [filterValue, setFilterValue] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [serialPhoto, setSerialPhoto] = useState('');
  const [facadePhoto, setFacadePhoto] = useState('');
  const [serialPhotoName, setSerialPhotoName] = useState('');
  const [facadePhotoName, setFacadePhotoName] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingRemoval, setSavingRemoval] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState('');
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<RoutePlan[]>([]);
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [cancellingRouteId, setCancellingRouteId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  async function loadSavedRoutes() {
    if (!canCreateRoute) return [];
    try {
      const routes = await apiFetch<RoutePlan[]>('/api/ordens-remocao/rotas');
      setSavedRoutes(routes);
      setRoutePlan((current) => current && routes.some((route) => route.id === current.id) ? current : null);
      return routes;
    }
    catch (error) { setRouteError(error instanceof Error ? error.message : 'Não foi possível carregar rotas salvas.'); }
    return [];
  }

  useEffect(() => { void loadOrders(); }, [filterField, filterValue, status]);
  useEffect(() => { void loadSavedRoutes(); }, [canCreateRoute]);

  const routeCandidates = orders.filter((order) => ['ABERTO', 'FALHA_TENTATIVA'].includes(order.status));
  const activeRoute = savedRoutes.find((route) => route.status === 'EM_ANDAMENTO');

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
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Não foi possível criar a remoção.'); }
    finally { setSavingRemoval(false); }
  }

  function openOrder(order: Order) {
    setSelected({ ...order, observacoes: order.observacoes ?? [] });
    setSerialPhoto('');
    setFacadePhoto('');
    setSerialPhotoName('');
    setFacadePhotoName('');
    setOrderMessage(null);
    setMessage(null);
  }

  async function deleteOrder(order: Order) {
    if (!window.confirm(`Excluir permanentemente a ordem de ${order.clienteNome}? Esta ação não pode ser desfeita.`)) return;
    setDeletingOrderId(order.id);
    try {
      await apiFetch<void>(`/api/ordens-remocao/${order.id}`, { method: 'DELETE' });
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelected((current) => current?.id === order.id ? null : current);
      setMessage('Ordem de remoção excluída.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a ordem.');
    } finally {
      setDeletingOrderId(null);
    }
  }

  function openRoutePlanner() {
    setRouteError(null);
    if (activeRoute) {
      setRoutePlan(activeRoute);
      setShowRoutePanel(false);
      return;
    }
    setShowRoutePanel(true);
  }

  async function updateStatus(nextStatus: 'CONCLUIDO' | 'FALHA_TENTATIVA') {
    if (!selected) return;
    if (selected.status === 'EM_OBSERVACAO' && nextStatus !== 'CONCLUIDO') {
      setOrderMessage('Esta ordem está em observação. O status só pode mudar quando a remoção for concluída.');
      return;
    }
    const attachment = nextStatus === 'CONCLUIDO' ? serialPhoto : facadePhoto;
    if (!attachment) {
      setOrderMessage(nextStatus === 'CONCLUIDO'
        ? 'Para concluir, anexe a foto do aparelho mostrando a etiqueta com o serial.'
        : 'Para registrar falha na tentativa, anexe uma foto da fachada do local.');
      return;
    }
    setOrderMessage(null);
    const body = {
      status: nextStatus,
      fotoSerialUrl: nextStatus === 'CONCLUIDO' ? attachment : null,
      fotoFachadaUrl: nextStatus === 'FALHA_TENTATIVA' ? attachment : null,
      substatusFalha: nextStatus === 'FALHA_TENTATIVA' ? 'CLIENTE_AUSENTE' : null,
    };
    try {
      const updated = await apiFetch<Order>(`/api/ordens-remocao/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
      setSelected((current) => current ? { ...current, ...updated, observacoes: current.observacoes ?? [] } : current);
      setSerialPhoto('');
      setFacadePhoto('');
      setSerialPhotoName('');
      setFacadePhotoName('');
      setOrderMessage(updated.status === 'EM_OBSERVACAO' ? 'Terceira tentativa sem sucesso. Ordem colocada em observação.' : 'Status atualizado com sucesso.');
      await loadOrders();
    } catch (error) { setOrderMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o status.'); }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    try {
      const created = await apiFetch<Observation>(`/api/ordens-remocao/${selected.id}/observacoes`, { method: 'POST', body: JSON.stringify({ texto: note }) });
      setSelected((current) => current ? { ...current, observacoes: [created, ...(current.observacoes ?? [])] } : current);
      setNote('');
      setOrderMessage('Observação registrada.');
    } catch (error) { setOrderMessage(error instanceof Error ? error.message : 'Não foi possível registrar a observação.'); }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) { setRouteError('Este dispositivo não disponibiliza localização. Marque a origem no mapa.'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setRouteOrigin(`${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`); setRouteError(null); },
      () => setRouteError('Não foi possível obter sua localização. Marque o ponto de partida no mapa.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function createRoute() {
    if (activeRoute) {
      setRoutePlan(activeRoute);
      setShowRoutePanel(false);
      return;
    }
    if (!routeOrigin) { setRouteError('Defina o ponto de partida pelo GPS ou clicando no mapa.'); return; }
    if (!routeCandidates.length) { setRouteError('Não há ordens abertas ou com tentativa sem sucesso disponíveis nesta lista.'); return; }
    setCreatingRoute(true);
    setRouteError(null);
    try {
      const created = await apiFetch<RoutePlan>('/api/ordens-remocao/rotas', { method: 'POST', body: JSON.stringify({ origem: routeOrigin, orderIds: routeCandidates.map((order) => order.id) }) });
      setRoutePlan(created);
      setSavedRoutes((current) => [created, ...current]);
      setMessage(`Rota criada com ${created.paradas.length} paradas.`);
      setShowRoutePanel(false);
      await loadOrders();
    } catch (error) { setRouteError(error instanceof Error ? error.message : 'Não foi possível criar a rota.'); }
    finally { setCreatingRoute(false); }
  }

  async function cancelRoute(route: RoutePlan) {
    if (!window.confirm('Cancelar esta rota e liberar novamente as ordens ainda roteirizadas?')) return;
    setCancellingRouteId(route.id);
    setRouteError(null);
    try {
      await apiFetch(`/api/ordens-remocao/rotas/${route.id}/cancelar`, { method: 'PATCH' });
      setSavedRoutes((current) => current.filter((item) => item.id !== route.id));
      setRoutePlan((current) => current?.id === route.id ? null : current);
      setMessage('Rota cancelada. As ordens em andamento voltaram ao status anterior.');
      await loadOrders();
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Não foi possível cancelar a rota.');
    } finally {
      setCancellingRouteId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 pb-6">
      <header className="flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Remoção</h1><p className="mt-1 text-sm text-slate-500">Fila geral de equipamentos para remoção.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canCreateRoute && <button type="button" disabled={!activeRoute && !routeCandidates.length} onClick={openRoutePlanner} className="rounded-xl border border-brand-600 px-4 py-3 text-sm font-semibold text-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{activeRoute ? 'Ver rota em andamento' : `Criar rota${routeCandidates.length ? ` (${routeCandidates.length})` : ''}`}</button>}
          {canManage && <button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">{showForm ? 'Fechar formulário' : 'Nova remoção'}</button>}
        </div>
      </header>

      {showRoutePanel && <section className="card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Planejar rota</h2><p className="mt-1 text-sm text-slate-600">Usará as {routeCandidates.length} ordens abertas ou com tentativa sem sucesso exibidas após os filtros atuais.</p></div><button type="button" onClick={() => setShowRoutePanel(false)} className="text-sm text-slate-500">Fechar</button></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" onClick={useDeviceLocation} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Usar minha localização</button><span className="text-xs text-slate-500">Ou clique no mapa para marcar o ponto de partida.</span></div>
        <LocationPicker value={routeOrigin} onChange={(value) => { setRouteOrigin(value); setRouteError(null); }} />
        {routeOrigin && <p className="text-sm font-medium text-emerald-700">Origem: {routeOrigin}</p>}
        {routeError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{routeError}</p>}
        <button type="button" disabled={creatingRoute || !routeCandidates.length} onClick={createRoute} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{creatingRoute ? 'Calculando sequência...' : 'Gerar rota otimizada'}</button>
      </section>}

      {savedRoutes.length > 0 && <section className="card space-y-3 p-5"><div><h2 className="font-semibold text-slate-900">Rota em andamento</h2><p className="mt-1 text-xs text-slate-500">Ela continuará visível enquanto houver ordem roteirizada.</p></div><div className="grid gap-2">{savedRoutes.map((route) => <div key={route.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => { setRoutePlan(route); setShowRoutePanel(false); }} className="flex flex-1 flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-medium text-slate-800">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(route.createdAt))} · {route.paradas.length} paradas · {route.distanciaKm.toFixed(1)} km</span><span className="text-xs font-semibold text-amber-700">Em andamento</span></button>{canCancelRoute && <button type="button" disabled={cancellingRouteId === route.id} onClick={() => cancelRoute(route)} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">{cancellingRouteId === route.id ? 'Cancelando...' : 'Cancelar rota'}</button>}</div>)}</div>{routeError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{routeError}</p>}</section>}

      {routePlan && <section className="card space-y-3 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Rota · {routePlan.status === 'EM_ANDAMENTO' ? 'Em andamento' : routePlan.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}</h2><p className="text-sm text-slate-600">{routePlan.paradas.length} paradas · cerca de {routePlan.distanciaKm.toFixed(1)} km em linha geográfica</p></div><button type="button" onClick={() => setRoutePlan(null)} className="text-sm text-slate-500">Fechar rota</button></div><p className="text-xs text-slate-500">Sequência aproximada por proximidade; cada etapa abre no Google Maps para calcular o trajeto pelas ruas.</p><ol className="space-y-2">{routePlan.paradas.map((stop, index) => { const origin = index === 0 ? routePlan.origem : routePlan.paradas[index - 1].ordem.localizacao; const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(stop.ordem.localizacao)}&travelmode=driving`; return <li key={stop.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase text-slate-500">Parada {stop.sequencia}</p><p className="font-medium text-slate-900">{stop.ordem.clienteNome}</p><p className="text-sm text-slate-600">{stop.ordem.endereco}, {stop.ordem.numero} · {stop.ordem.bairro}</p></div><a href={mapUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white">Navegar até a parada</a></li>; })}</ol></section>}

      {showForm && <form onSubmit={createRemoval} className="card grid gap-3 p-5 sm:grid-cols-2"><h2 className="text-lg font-semibold sm:col-span-2">Dados da remoção</h2>{([['clienteNome', 'Nome completo do cliente'], ['endereco', 'Endereço'], ['numero', 'Número (digite S/N caso não tenha número)'], ['bairro', 'Bairro'], ['pontoReferencia', 'Ponto de referência']] as const).map(([field, label]) => <label key={field} className="text-sm font-medium text-slate-700">{label} <span className="text-rose-600">*</span><input required value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>)}<div className="sm:col-span-2"><p className="text-sm font-medium text-slate-700">Localização exata <span className="text-rose-600">*</span></p><div className="mt-1"><LocationPicker value={form.localizacao} onChange={(value) => setForm((current) => ({ ...current, localizacao: value }))} /></div></div><label className="text-sm font-medium text-slate-700">Serial do aparelho (opcional)<input inputMode="text" maxLength={12} value={form.equipamentoSerial} onChange={(event) => setForm((current) => ({ ...current, equipamentoSerial: event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="12 caracteres" />{form.equipamentoSerial && form.equipamentoSerial.length !== 12 && <span className="text-xs text-rose-600">O serial deve conter 12 caracteres alfanuméricos.</span>}</label><label className="text-sm font-medium text-slate-700">Número para contato (opcional)<input inputMode="tel" value={form.telefoneContato} onChange={(event) => setForm((current) => ({ ...current, telefoneContato: formatPhone(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="91 98533-4309" />{form.telefoneContato && form.telefoneContato.replace(/\D/g, '').length !== 11 && <span className="text-xs text-rose-600">Informe DDD e número com 11 dígitos.</span>}</label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Foto da fachada (opcional)<input type="file" accept="image/*" onChange={(event) => fileToDataUrl(event, (value) => setForm((current) => ({ ...current, fotoFachadaUrl: value })))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>{formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{formError}</p>}<button type="submit" disabled={savingRemoval} className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2">{savingRemoval ? 'Criando remoção...' : 'Criar remoção'}</button></form>}

      <section className="card grid gap-3 p-4 sm:grid-cols-[180px_1fr_180px]"><select value={filterField} onChange={(event) => setFilterField(event.target.value as FilterField)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="clienteNome">Nome do cliente</option><option value="endereco">Endereço</option><option value="numero">Número</option><option value="bairro">Bairro</option><option value="pontoReferencia">Ponto de referência</option></select><input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="Digite para filtrar" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Todos os status</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></section>
      {message && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm">{message}</p>}
      {loading ? <p className="p-4 text-sm text-slate-500">Carregando remoções...</p> : <section className="grid gap-3">{orders.map((order) => <article key={order.id} className="card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{order.clienteNome}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[order.status]}`}>{labels[order.status]}</span></div><p className="mt-2 text-sm text-slate-600">{order.endereco}, {order.numero} · {order.bairro}</p><p className="mt-1 text-xs text-slate-500">Referência: {order.pontoReferencia}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openOrder(order)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Consultar ordem</button>{canDeleteOrder && <button type="button" disabled={deletingOrderId === order.id} onClick={() => void deleteOrder(order)} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">{deletingOrderId === order.id ? 'Excluindo...' : 'Excluir ordem'}</button>}</div></div></article>)}</section>}

      {selected && <div className="fixed inset-0 z-10 overflow-y-auto bg-slate-950/40 p-4"><section className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Ordem de remoção</h2><p className="mt-1 text-sm text-slate-500">{selected.clienteNome} · {labels[selected.status]}</p></div><button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-500">Fechar</button></div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Endereço</dt><dd>{selected.endereco}, {selected.numero}</dd></div><div><dt className="text-slate-500">Bairro</dt><dd>{selected.bairro}</dd></div><div><dt className="text-slate-500">Ponto de referência</dt><dd>{selected.pontoReferencia}</dd></div><div><dt className="text-slate-500">Serial</dt><dd>{selected.equipamentoSerial || 'Não informado'}</dd></div><div><dt className="text-slate-500">Tentativas sem sucesso</dt><dd>{selected.tentativasFalha}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Localização</dt><dd><a className="font-medium text-brand-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.localizacao)}`}>Abrir no Google Maps</a></dd></div></dl>
        {selected.status === 'EM_OBSERVACAO' && <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">Limite de três tentativas atingido. Esta ordem só pode ser concluída.</p>}
        {canChangeStatus && selected.status !== 'CONCLUIDO' && <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">Concluir remoção</p><p className="mt-1 text-xs text-slate-500">Anexe uma foto do aparelho mostrando a etiqueta com o serial.</p><label htmlFor="serial-photo" className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">{serialPhotoName || 'Escolher foto do aparelho'}</label><input id="serial-photo" type="file" accept="image/*" className="sr-only" onChange={(event) => { setSerialPhotoName(event.target.files?.[0]?.name ?? ''); setOrderMessage(null); fileToDataUrl(event, setSerialPhoto); }} /><button type="button" onClick={() => updateStatus('CONCLUIDO')} className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white">Concluir</button></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">Falha na tentativa</p><p className="mt-1 text-xs text-slate-500">Anexe uma foto da fachada do local visitado.</p><label htmlFor="facade-photo" className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">{facadePhotoName || 'Escolher foto da fachada'}</label><input id="facade-photo" type="file" accept="image/*" className="sr-only" onChange={(event) => { setFacadePhotoName(event.target.files?.[0]?.name ?? ''); setOrderMessage(null); fileToDataUrl(event, setFacadePhoto); }} /><button type="button" onClick={() => updateStatus('FALHA_TENTATIVA')} className="mt-2 w-full rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white">Registrar falha</button></div></div>}
        {orderMessage && <p role="alert" className={`mt-3 rounded-lg p-3 text-sm ${orderMessage.includes('sucesso') || orderMessage.includes('registrada') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{orderMessage}</p>}
        {canAddNote && <form onSubmit={addNote} className="mt-5 border-t border-slate-200 pt-4"><label className="text-sm font-medium">Nova observação<textarea required value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label><button className="mt-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Registrar observação</button></form>}
        <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">Histórico de observações</h3>{!selected.observacoes?.length ? <p className="mt-2 text-sm text-slate-500">Nenhuma observação registrada.</p> : <div className="mt-3 space-y-3">{selected.observacoes.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm text-slate-800">{item.texto}</p><p className="mt-1 text-xs text-slate-500">{item.usuario.nome} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}</p></div>)}</div>}</div>
      </section></div>}
    </main>
  );
}
