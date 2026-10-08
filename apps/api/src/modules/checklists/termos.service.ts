import { RoleCode, StatusChecklist, StatusUsuario } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export class TermOperationError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export async function createResponsibilityTerm(actorId: string, usuarioDesignadoId: string, descricao: string) {
  if (actorId === usuarioDesignadoId) throw new TermOperationError('Selecione outro usuário para receber o termo.', 400);

  return prisma.$transaction(async (transaction) => {
    const [actor, assignee] = await Promise.all([
      transaction.usuario.findUnique({ where: { id: actorId }, select: { nome: true } }),
      transaction.usuario.findUnique({ where: { id: usuarioDesignadoId }, select: { nome: true, email: true, status: true } }),
    ]);
    if (!actor) throw new TermOperationError('Usuário emissor não encontrado.', 404);
    if (!assignee) throw new TermOperationError('Usuário designado não encontrado.', 404);
    if (assignee.status !== StatusUsuario.ATIVO) throw new TermOperationError('Somente usuários ativos podem receber termos.', 409);

    const term = await transaction.termoResponsabilidade.create({
      data: {
        descricao: descricao.trim(),
        criadoPorId: actorId,
        criadoPorNome: actor.nome,
        usuarioDesignadoId,
        usuarioDesignadoNome: assignee.nome,
        usuarioDesignadoEmail: assignee.email,
      },
    });
    await transaction.logAuditoria.create({
      data: {
        usuarioId: actorId,
        autorMasterAdmin: true,
        acao: 'TERMO_RESPONSABILIDADE_EMITIDO',
        entidade: 'TERMO_RESPONSABILIDADE',
        entidadeId: term.id,
        valorNovo: { usuarioDesignadoId, usuarioDesignadoNome: assignee.nome },
      },
    });
    return term;
  });
}

export function listAssignedResponsibilityTerms(usuarioId: string) {
  return prisma.termoResponsabilidade.findMany({
    where: { usuarioDesignadoId: usuarioId },
    orderBy: [{ assinadoEm: 'asc' }, { createdAt: 'desc' }],
  });
}

export function listIssuedResponsibilityTerms() {
  return prisma.termoResponsabilidade.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function signResponsibilityTerm(usuarioId: string, termId: string, assinaturaData: string) {
  return prisma.$transaction(async (transaction) => {
    const term = await transaction.termoResponsabilidade.findFirst({ where: { id: termId, usuarioDesignadoId: usuarioId } });
    if (!term) throw new TermOperationError('Termo não encontrado para este usuário.', 404);
    if (term.assinadoEm) throw new TermOperationError('Este termo já foi assinado.', 409);

    const signer = await transaction.usuario.findUnique({
      where: { id: usuarioId },
      select: { roles: { select: { perfil: { select: { code: true } } } } },
    });
    if (!signer) throw new TermOperationError('Usuário não encontrado.', 404);

    const updated = await transaction.termoResponsabilidade.updateMany({
      where: { id: termId, usuarioDesignadoId: usuarioId, assinadoEm: null },
      data: { assinaturaData, assinadoEm: new Date() },
    });
    if (updated.count !== 1) throw new TermOperationError('Este termo já foi assinado.', 409);

    const signedTerm = await transaction.termoResponsabilidade.findUniqueOrThrow({ where: { id: termId } });
    const isMasterAdmin = signer.roles.some(({ perfil }) => perfil.code === RoleCode.MASTER_ADMIN);
    await transaction.logAuditoria.create({
      data: {
        usuarioId,
        autorMasterAdmin: isMasterAdmin,
        acao: 'TERMO_RESPONSABILIDADE_ASSINADO',
        entidade: 'TERMO_RESPONSABILIDADE',
        entidadeId: termId,
      },
    });
    return signedTerm;
  });
}

export async function deletePendingChecklist(checklistId: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const checklist = await transaction.checklist.findUnique({
      where: { id: checklistId },
      select: { id: true, usuarioId: true, usuarioNome: true, categoria: true, status: true, excluidoEm: true },
    });
    if (!checklist || checklist.excluidoEm) throw new TermOperationError('Checklist não encontrado.', 404);
    const pendingStatuses: StatusChecklist[] = [StatusChecklist.PENDENTE, StatusChecklist.EM_ATRASO, StatusChecklist.PENDENTE_APROVACAO];
    if (!pendingStatuses.includes(checklist.status)) {
      throw new TermOperationError('Somente checklists pendentes podem ser excluídos.', 409);
    }

    await transaction.checklist.update({ where: { id: checklistId }, data: { excluidoEm: new Date() } });
    await transaction.logAuditoria.create({
      data: {
        usuarioId: actorId,
        autorMasterAdmin: true,
        acao: 'CHECKLIST_PENDENTE_EXCLUIDO',
        entidade: 'CHECKLIST',
        entidadeId: checklist.id,
        valorAntigo: { usuarioId: checklist.usuarioId, usuarioNome: checklist.usuarioNome, categoria: checklist.categoria, status: checklist.status },
      },
    });
    return checklist;
  });
}

