import { Prisma, RoleCode } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type AuditLogInput = {
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  valorAntigo?: Prisma.InputJsonValue | null;
  valorNovo?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  autorMasterAdmin?: boolean;
};

export async function createAuditLog(input: AuditLogInput) {
  return prisma.logAuditoria.create({
    data: {
      usuarioId: input.usuarioId ?? null,
      autorMasterAdmin: input.autorMasterAdmin ?? false,
      acao: input.acao,
      entidade: input.entidade,
      entidadeId: input.entidadeId ?? null,
      valorAntigo:
        input.valorAntigo === undefined || input.valorAntigo === null
          ? Prisma.JsonNull
          : (input.valorAntigo as Prisma.InputJsonValue),
      valorNovo:
        input.valorNovo === undefined || input.valorNovo === null
          ? Prisma.JsonNull
          : (input.valorNovo as Prisma.InputJsonValue),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function listAuditLogs(filters?: {
  entidade?: string;
  usuarioId?: string;
  acao?: string;
  from?: Date;
  to?: Date;
}) {
  return prisma.logAuditoria.findMany({
    where: {
      autorMasterAdmin: false,
      ...(filters?.entidade ? { entidade: filters.entidade } : {}),
      ...(filters?.usuarioId ? { usuarioId: filters.usuarioId } : {}),
      ...(filters?.acao ? { acao: filters.acao } : {}),
      ...(filters?.from || filters?.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  });
}

export async function getAuditFilterOptions() {
  const auditWhere = { autorMasterAdmin: false };
  const [modules, actions, collaborators] = await Promise.all([
    prisma.logAuditoria.findMany({ where: auditWhere, distinct: ['entidade'], select: { entidade: true }, orderBy: { entidade: 'asc' } }),
    prisma.logAuditoria.findMany({ where: auditWhere, distinct: ['acao'], select: { acao: true }, orderBy: { acao: 'asc' } }),
    prisma.usuario.findMany({
      where: { roles: { none: { perfil: { is: { code: RoleCode.MASTER_ADMIN } } } } },
      select: { id: true, nome: true },
      orderBy: [{ nome: 'asc' }, { email: 'asc' }],
    }),
  ]);
  return { modules: modules.map(({ entidade }) => entidade), actions: actions.map(({ acao }) => acao), collaborators };
}

export async function getAuditLogById(id: string) {
  return prisma.logAuditoria.findFirst({
    where: { id, autorMasterAdmin: false },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  });
}
