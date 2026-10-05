import { Prisma, StatusChecklist, StatusOrdemRemocao, TipoRespostaChecklist } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type DashboardPeriod = { from?: Date; to?: Date };

function dateFilter(period: DashboardPeriod, field: 'createdAt' | 'dataPreenchimento' | 'dataAgenda') {
  if (!period.from && !period.to) return {};
  return { [field]: { ...(period.from ? { gte: period.from } : {}), ...(period.to ? { lte: period.to } : {}) } };
}

export async function getDashboardSummary(period: DashboardPeriod, checklistUsuarioId?: string) {
  const checklistDateWhere = dateFilter(period, 'dataPreenchimento');
  const removalDateWhere = dateFilter(period, 'createdAt');
  const completedStatuses: StatusChecklist[] = [StatusChecklist.PREENCHIDO, StatusChecklist.APROVADO, StatusChecklist.REPROVADO];

  const [pendingChecklists, filledChecklists, lateFilledChecklists, unresolvedResponses, completedRemovals, openRemovals, failedRemovals] = await Promise.all([
    prisma.checklist.count({
      where: {
        ...dateFilter(period, 'dataAgenda'),
        ...(checklistUsuarioId ? { usuarioId: checklistUsuarioId } : {}),
        OR: [
          { status: { in: [StatusChecklist.EM_ATRASO, StatusChecklist.PENDENTE_APROVACAO] } },
          { status: StatusChecklist.PENDENTE, dataPrevista: { lte: new Date() } },
        ],
      },
    }),
    prisma.checklist.count({ where: { ...checklistDateWhere, ...(checklistUsuarioId ? { usuarioId: checklistUsuarioId } : {}), status: { in: completedStatuses } } }),
    prisma.checklist.count({ where: { ...checklistDateWhere, ...(checklistUsuarioId ? { usuarioId: checklistUsuarioId } : {}), status: { in: completedStatuses }, justificativaAtraso: { not: null } } }),
    prisma.checklistResposta.findMany({
      where: { respostaTipo: TipoRespostaChecklist.NAO_CONFORME, resolvidoEm: null, checklist: { ...checklistDateWhere, ...(checklistUsuarioId ? { usuarioId: checklistUsuarioId } : {}) } },
      include: { template: { select: { pergunta: true } }, checklist: { select: { id: true, categoria: true, dataPreenchimento: true, justificativaAtraso: true, usuario: { select: { nome: true } } } } },
      orderBy: { registradoEm: 'desc' },
    }),
    prisma.ordemRemocao.count({ where: { ...removalDateWhere, status: StatusOrdemRemocao.CONCLUIDO } }),
    prisma.ordemRemocao.count({ where: { ...removalDateWhere, status: { in: [StatusOrdemRemocao.ABERTO, StatusOrdemRemocao.ROTEIRIZADO] } } }),
    prisma.ordemRemocao.count({ where: { ...removalDateWhere, status: StatusOrdemRemocao.FALHA_TENTATIVA } }),
  ]);

  return {
    checklists: { pending: pendingChecklists, filled: filledChecklists, filledLate: lateFilledChecklists, issuesToResolve: unresolvedResponses },
    removals: { completed: completedRemovals, open: openRemovals, failed: failedRemovals, routes: null as number | null },
  };
}

export async function resolveChecklistResponse(responseId: string, userId: string, canResolveAny: boolean) {
  const response = await prisma.checklistResposta.findUnique({ where: { id: responseId }, include: { checklist: { select: { usuarioId: true } } } });
  if (!response) throw new Error('Item de checklist não encontrado.');
  if (!canResolveAny && response.checklist.usuarioId !== userId) throw new Error('Você só pode resolver itens dos seus próprios checklists.');
  if (response.resolvidoEm) throw new Error('Este item já foi resolvido.');
  return prisma.checklistResposta.update({
    where: { id: responseId },
    data: { resolvidoEm: new Date(), resolvidoPorId: userId },
    select: { id: true, resolvidoEm: true, resolvidoPorId: true },
  });
}
