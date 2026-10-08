import type { Request, Response } from 'express';
import { z } from 'zod';
import { createAuditLog, getAuditFilterOptions, listAuditLogs, getAuditLogById } from './auditoria.service.js';

const createAuditLogSchema = z.object({
  acao: z.string().min(3, 'Ação obrigatória.'),
  entidade: z.string().min(2, 'Entidade obrigatória.'),
  entidadeId: z.string().optional().nullable(),
  valorAntigo: z.record(z.any()).optional().nullable(),
  valorNovo: z.record(z.any()).optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
});

const filtersSchema = z.object({
  entidade: z.string().optional(),
  usuarioId: z.string().uuid().optional(),
  acao: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function createAuditLogController(req: Request, res: Response) {
  const parsed = createAuditLogSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Dados de auditoria inválidos.',
      errors: parsed.error.flatten(),
    });
  }

  try {
    const log = await createAuditLog({
      usuarioId: req.user?.id,
      autorMasterAdmin: req.user?.roles.includes('MASTER_ADMIN'),
      ...parsed.data,
      ipAddress: req.ip?.toString() ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });

    return res.status(201).json(log);
  } catch {
    return res.status(500).json({
      message: 'Erro ao registrar log de auditoria.',
    });
  }
}

export async function getAuditFilterOptionsController(_req: Request, res: Response) {
  try { return res.status(200).json(await getAuditFilterOptions()); }
  catch { return res.status(500).json({ message: 'Não foi possível carregar as opções de auditoria.' }); }
}

export async function listAuditLogsController(req: Request, res: Response) {
  const parsed = filtersSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parâmetros inválidos.',
      errors: parsed.error.flatten(),
    });
  }

  try {
    const { from, to, ...filters } = parsed.data;
    if (from && to && new Date(from) > new Date(to)) {
      return res.status(400).json({ message: 'A data inicial deve ser anterior à data final.' });
    }
    const logs = await listAuditLogs({ ...filters, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });
    return res.status(200).json(logs);
  } catch {
    return res.status(500).json({
      message: 'Erro ao listar logs de auditoria.',
    });
  }
}

export async function getAuditLogController(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const log = await getAuditLogById(id);

    if (!log) {
      return res.status(404).json({ message: 'Log não encontrado.' });
    }

    return res.status(200).json(log);
  } catch {
    return res.status(500).json({
      message: 'Erro ao buscar log de auditoria.',
    });
  }
}
