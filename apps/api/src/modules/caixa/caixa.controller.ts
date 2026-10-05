import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  approveCashClosure,
  closeCashTurn,
  getCashTurnById,
  getOpenCashTurnByOperator,
  listCashHistoryByOperator,
  openCashTurn,
} from './caixa.service.js';

const openSchema = z.object({
  valorEsperado: z.number().min(0, 'Valor esperado deve ser maior ou igual a zero.'),
});

const closeSchema = z.object({
  valorEmMaos: z.number().min(0, 'Valor em mãos deve ser maior ou igual a zero.'),
  justificativa: z.string().optional().nullable(),
});

export async function openCashTurnController(req: Request, res: Response) {
  const parsed = openSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Dados de abertura de turno inválidos.',
      errors: parsed.error.flatten(),
    });
  }

  const operadorId = req.user?.id;

  if (!operadorId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const shift = await openCashTurn({
      operadorId,
      valorEsperado: parsed.data.valorEsperado,
    });

    return res.status(201).json(shift);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao abrir turno.',
    });
  }
}

export async function closeCashTurnController(req: Request, res: Response) {
  const parsed = closeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Dados de fechamento inválidos.',
      errors: parsed.error.flatten(),
    });
  }

  const operadorId = req.user?.id;

  if (!operadorId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const shift = await closeCashTurn({
      operadorId,
      valorEmMaos: parsed.data.valorEmMaos,
      justificativa: parsed.data.justificativa,
    });

    return res.status(200).json(shift);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao fechar turno.',
    });
  }
}

export async function getOpenCashTurnController(req: Request, res: Response) {
  const operadorId = req.user?.id;

  if (!operadorId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const shift = await getOpenCashTurnByOperator(operadorId);
    return res.status(200).json(shift ?? null);
  } catch {
    return res.status(500).json({
      message: 'Erro ao buscar turno aberto.',
    });
  }
}

export async function listCashHistoryController(req: Request, res: Response) {
  const operadorId = req.user?.id;

  if (!operadorId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const history = await listCashHistoryByOperator(operadorId);
    return res.status(200).json(history);
  } catch {
    return res.status(500).json({
      message: 'Erro ao listar histórico de caixa.',
    });
  }
}

export async function approvalCashClosureController(req: Request, res: Response) {
  const { turnoId } = req.params;

  try {
    const turn = await approveCashClosure(turnoId, req.user?.id ?? 'system');
    return res.status(200).json(turn);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao aprovar fechamento.',
    });
  }
}

export async function getCashTurnController(req: Request, res: Response) {
  const { turnoId } = req.params;

  try {
    const turn = await getCashTurnById(turnoId);

    if (!turn) {
      return res.status(404).json({ message: 'Turno não encontrado.' });
    }

    return res.status(200).json(turn);
  } catch {
    return res.status(500).json({
      message: 'Erro ao buscar turno.',
    });
  }
}
