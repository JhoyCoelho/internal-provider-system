import { Prisma, StatusOrdemRemocao, StatusRotaRemocao, SubstatusFalha } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { closeRoutesForOrder } from './rotas.service.js';

export type CreateOrderInput = {
  clienteNome: string;
  endereco: string;
  numero: string;
  bairro: string;
  pontoReferencia: string;
  localizacao: string;
  regiao?: string;
  equipamentoSerial?: string | null;
  telefoneContato?: string | null;
  fotoFachadaUrl?: string | null;
  tecnicoId?: string | null;
  criadoPorId?: string | null;
  status?: StatusOrdemRemocao;
};

export type UpdateOrderStatusInput = {
  status: StatusOrdemRemocao;
  substatusFalha?: SubstatusFalha | null;
  fotoSerialUrl?: string | null;
  fotoFachadaUrl?: string | null;
};

export async function listOrders(filters?: { status?: StatusOrdemRemocao; clienteNome?: string; endereco?: string; numero?: string; bairro?: string; pontoReferencia?: string; regiao?: string; tecnicoId?: string }) {
  const where: Prisma.OrdemRemocaoWhereInput = {
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.clienteNome ? { clienteNome: { contains: filters.clienteNome, mode: 'insensitive' } } : {}),
    ...(filters?.endereco ? { endereco: { contains: filters.endereco, mode: 'insensitive' } } : {}),
    ...(filters?.numero ? { numero: { contains: filters.numero, mode: 'insensitive' } } : {}),
    ...(filters?.regiao ? { regiao: { contains: filters.regiao, mode: 'insensitive' } } : {}),
    ...(filters?.bairro ? { bairro: { contains: filters.bairro, mode: 'insensitive' } } : {}),
    ...(filters?.pontoReferencia ? { pontoReferencia: { contains: filters.pontoReferencia, mode: 'insensitive' } } : {}),
    ...(filters?.tecnicoId ? { tecnicoId: filters.tecnicoId } : {}),
  };

  return prisma.ordemRemocao.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: { tecnico: { select: { id: true, nome: true, email: true } }, criadoPor: { select: { id: true, nome: true } }, observacoes: { orderBy: { createdAt: 'desc' }, include: { usuario: { select: { nome: true } } } } },
  });
}

export async function getOrderById(id: string) {
  return prisma.ordemRemocao.findUnique({
    where: { id },
    include: { tecnico: { select: { id: true, nome: true, email: true } }, criadoPor: { select: { id: true, nome: true } }, observacoes: { orderBy: { createdAt: 'desc' }, include: { usuario: { select: { nome: true } } } } },
  });
}

export async function deleteRemovalOrder(id: string) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.ordemRemocao.findUnique({ where: { id }, select: { id: true } });
    if (!order) return false;

    const activeRouteIds = await transaction.rotaRemocaoParada.findMany({
      where: { ordemId: id, rota: { status: StatusRotaRemocao.EM_ANDAMENTO } },
      select: { rotaId: true },
    });

    await transaction.rotaRemocaoParada.deleteMany({ where: { ordemId: id } });
    await transaction.ordemRemocao.delete({ where: { id } });

    for (const { rotaId } of activeRouteIds) {
      const unfinishedStops = await transaction.rotaRemocaoParada.count({
        where: { rotaId, ordem: { status: StatusOrdemRemocao.ROTEIRIZADO } },
      });
      if (unfinishedStops === 0) {
        await transaction.rotaRemocao.updateMany({
          where: { id: rotaId, status: StatusRotaRemocao.EM_ANDAMENTO },
          data: { status: StatusRotaRemocao.CONCLUIDA, completedAt: new Date() },
        });
      }
    }

    return true;
  });
}

export async function createOrder(input: CreateOrderInput) {
  return prisma.ordemRemocao.create({
    data: {
      clienteNome: input.clienteNome.trim(),
      endereco: input.endereco.trim(),
      numero: input.numero.trim(),
      bairro: input.bairro.trim(),
      pontoReferencia: input.pontoReferencia.trim(),
      localizacao: input.localizacao.trim(),
      regiao: input.regiao?.trim() || input.bairro.trim(),
      equipamentoSerial: input.equipamentoSerial?.trim() || null,
      telefoneContato: input.telefoneContato?.trim() || null,
      fotoFachadaUrl: input.fotoFachadaUrl || null,
      status: input.status ?? StatusOrdemRemocao.ABERTO,
      tecnicoId: input.tecnicoId ?? null,
      criadoPorId: input.criadoPorId ?? null,
    },
    include: { tecnico: { select: { id: true, nome: true, email: true } } },
  });
}

export async function addObservation(orderId: string, usuarioId: string, texto: string) {
  const order = await prisma.ordemRemocao.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new Error('Ordem de remoção não encontrada.');
  return prisma.observacaoRemocao.create({ data: { ordemId: orderId, usuarioId, texto: texto.trim() }, include: { usuario: { select: { nome: true } } } });
}

export async function assignTechnician(orderId: string, tecnicoId: string) {
  const order = await prisma.ordemRemocao.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Ordem de remoção não encontrada.');

  return prisma.ordemRemocao.update({
    where: { id: orderId },
    data: { tecnicoId, status: order.status === StatusOrdemRemocao.ABERTO ? StatusOrdemRemocao.ROTEIRIZADO : order.status },
    include: { tecnico: { select: { id: true, nome: true, email: true } } },
  });
}

export async function updateOrderStatus(orderId: string, payload: UpdateOrderStatusInput) {
  const order = await prisma.ordemRemocao.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Ordem de remoção não encontrada.');
  if (order.status === StatusOrdemRemocao.EM_OBSERVACAO && payload.status !== StatusOrdemRemocao.CONCLUIDO) {
    throw new Error('Esta ordem está em observação. O status só poderá mudar quando a remoção for concluída.');
  }
  if (order.status === StatusOrdemRemocao.CONCLUIDO && payload.status !== StatusOrdemRemocao.CONCLUIDO) {
    throw new Error('Uma remoção concluída não pode voltar para outro status.');
  }

  const fotoSerialUrl = payload.fotoSerialUrl ?? order.fotoSerialUrl;
  const fotoFachadaUrl = payload.fotoFachadaUrl ?? order.fotoFachadaUrl;
  const substatusFalha = payload.substatusFalha ?? order.substatusFalha;

  if (payload.status === StatusOrdemRemocao.CONCLUIDO && !fotoSerialUrl) throw new Error('A ordem concluída exige foto do roteador/serial.');
  if (payload.status === StatusOrdemRemocao.FALHA_TENTATIVA && (!substatusFalha || !fotoFachadaUrl)) throw new Error('A falha na tentativa exige substatus e foto da fachada.');

  const tentativasFalha = order.tentativasFalha + (payload.status === StatusOrdemRemocao.FALHA_TENTATIVA ? 1 : 0);
  const effectiveStatus = payload.status === StatusOrdemRemocao.FALHA_TENTATIVA && tentativasFalha >= 3
    ? StatusOrdemRemocao.EM_OBSERVACAO
    : payload.status;

  const updated = await prisma.ordemRemocao.update({
    where: { id: orderId },
    data: { status: effectiveStatus, tentativasFalha, substatusFalha, fotoSerialUrl, fotoFachadaUrl },
    include: { tecnico: { select: { id: true, nome: true, email: true } } },
  });
  await closeRoutesForOrder(orderId);
  return updated;
}
