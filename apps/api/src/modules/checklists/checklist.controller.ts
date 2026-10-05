import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  approveChecklist,
  createChecklist,
  createChecklistTemplate,
  createLateChecklist,
  getChecklistHistory,
  listChecklistTemplates,
  listPendingChecklistsByUser,
  listPendingChecklistForSupervisor,
  justifyLateChecklist,
  rejectChecklist,
} from './checklist.service.js';

const templateSchema = z.object({
  categoria: z.string().min(2).max(40).optional(),
  pergunta: z.string().min(3, 'Pergunta obrigatória.'),
  tipoResposta: z.enum(['OK', 'NAO_CONFORME', 'TEXTO']),
  obrigatoria: z.boolean().optional(),
  itemCritico: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

const answerSchema = z.object({
  templateId: z.string().uuid(),
  respostaTipo: z.enum(['OK', 'NAO_CONFORME', 'TEXTO']),
  valorTexto: z.string().optional().nullable(),
  valorBooleano: z.boolean().optional().nullable(),
  itemCritico: z.boolean().optional(),
});

const checklistSubmitSchema = z.object({
  checklistId: z.string().uuid(),
  categoria: z.string().min(2).max(40).optional(),
  assinaturaData: z.string().min(1),
  answers: z.array(answerSchema).min(1, 'É necessário ao menos uma resposta.'),
});

const lateChecklistSchema = z.object({
  checklistId: z.string().uuid(),
  motivo: z.enum(['ESQUECIMENTO', 'FALHA_SISTEMA', 'OUTROS']),
  descricao: z.string().min(5, 'Descrição obrigatória.'),
  assinaturaData: z.string().min(1),
});

export async function listTemplatesController(_req: Request, res: Response) {
  try {
    const templates = await listChecklistTemplates();
    return res.status(200).json(templates);
  } catch {
    return res.status(500).json({
      message: 'Erro ao listar templates.',
    });
  }
}

export async function createTemplateController(req: Request, res: Response) {
  const parsed = templateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Dados de template inválidos.',
      errors: parsed.error.flatten(),
    });
  }

  try {
    const template = await createChecklistTemplate(parsed.data);
    return res.status(201).json(template);
  } catch {
    return res.status(500).json({
      message: 'Erro ao criar template.',
    });
  }
}

export async function submitChecklistController(req: Request, res: Response) {
  const parsed = checklistSubmitSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Checklist inválido.',
      errors: parsed.error.flatten(),
    });
  }

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const checklist = await createChecklist(userId, parsed.data.answers, parsed.data.assinaturaData, parsed.data.checklistId, parsed.data.categoria);
    return res.status(201).json(checklist);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao salvar checklist.',
    });
  }
}

export async function submitLateChecklistController(req: Request, res: Response) {
  const parsed = lateChecklistSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Checklist em atraso inválido.',
      errors: parsed.error.flatten(),
    });
  }

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const checklist = await justifyLateChecklist(userId, parsed.data.checklistId, parsed.data.motivo, parsed.data.descricao, parsed.data.assinaturaData);
    return res.status(201).json(checklist);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao registrar checklist em atraso.',
    });
  }
}

export async function listMyPendingChecklistsController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Usuário não autenticado.' });

  try {
    return res.status(200).json(await listPendingChecklistsByUser(userId));
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao buscar pendências.' });
  }
}

export async function getChecklistHistoryController(req: Request, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const history = await getChecklistHistory(userId);
    return res.status(200).json(history);
  } catch {
    return res.status(500).json({
      message: 'Erro ao buscar histórico de checklist.',
    });
  }
}

export async function listPendingApprovalsController(_req: Request, res: Response) {
  try {
    const checklists = await listPendingChecklistForSupervisor();
    return res.status(200).json(checklists);
  } catch {
    return res.status(500).json({
      message: 'Erro ao buscar pendências de aprovação.',
    });
  }
}

export async function approveChecklistController(req: Request, res: Response) {
  const { checklistId } = req.params;
  const aprovadorId = req.user?.id;

  if (!aprovadorId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const checklist = await approveChecklist(checklistId, aprovadorId);
    return res.status(200).json(checklist);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao aprovar checklist.',
    });
  }
}

export async function rejectChecklistController(req: Request, res: Response) {
  const { checklistId } = req.params;
  const { motivo } = req.body;
  const aprovadorId = req.user?.id;

  if (!aprovadorId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  if (!motivo || motivo.trim().length < 5) {
    return res.status(400).json({ message: 'Motivo da reprovação obrigatório.' });
  }

  try {
    const checklist = await rejectChecklist(checklistId, aprovadorId, motivo);
    return res.status(200).json(checklist);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Erro ao reprovar checklist.',
    });
  }
}
