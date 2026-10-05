import { Prisma } from '@prisma/client';
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
};

export async function createAuditLog(input: AuditLogInput) {
  return prisma.logAuditoria.create({
    data: {
      usuarioId: input.usuarioId ?? null,
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
  colaborador?: string;
  acao?: string;
  from?: Date;
  to?: Date;
}) {
  return prisma.logAuditoria.findMany({
    where: {
      ...(filters?.entidade ? { entidade: { contains: filters.entidade, mode: 'insensitive' } } : {}),
      ...(filters?.usuarioId ? { usuarioId: filters.usuarioId } : {}),
      ...(filters?.colaborador ? { usuario: { is: { nome: { contains: filters.colaborador, mode: 'insensitive' } } } } : {}),
      ...(filters?.acao ? { acao: { contains: filters.acao, mode: 'insensitive' } } : {}),
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

export async function getAuditLogById(id: string) {
  return prisma.logAuditoria.findUnique({
    where: { id },
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
