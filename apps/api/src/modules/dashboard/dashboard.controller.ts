import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDashboardSummary, resolveChecklistResponse } from './dashboard.service.js';

const periodSchema = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });

export async function dashboardSummaryController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsed = periodSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Período inválido.', errors: parsed.error.flatten() });
  const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
  const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
  if (from && to && from > to) return res.status(400).json({ message: 'A data inicial deve ser anterior à data final.' });
  const roles = req.user?.roles ?? [];
  const canViewAllChecklists = roles.includes('MASTER_ADMIN');
  const canViewChecklists = roles.some((role) => ['MASTER_ADMIN', 'TECNICO'].includes(role));
  try {
    const summary = await getDashboardSummary({ from, to }, canViewAllChecklists ? undefined : userId);
    if (!canViewChecklists) summary.checklists = { pending: 0, filled: 0, filledLate: 0, issuesToResolve: [] };
    return res.status(200).json(summary);
  }
  catch (error) { return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao gerar resumo do Dashboard.' }); }
}

export async function resolveChecklistResponseController(req: Request, res: Response) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const canResolveAny = user.roles.some((role) => ['MASTER_ADMIN', 'SUPERVISOR', 'COORDENADOR'].includes(role));
  const userId = user.id;
  try { return res.status(200).json(await resolveChecklistResponse(req.params.responseId, userId, canResolveAny)); }
  catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao resolver item.' }); }
}
