import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createResponsibilityTerm,
  deletePendingChecklist,
  listAssignedResponsibilityTerms,
  listIssuedResponsibilityTerms,
  signResponsibilityTerm,
  TermOperationError,
} from './termos.service.js';

const createTermSchema = z.object({
  usuarioDesignadoId: z.string().uuid(),
  descricao: z.string().trim().min(5).max(20000),
});
const signTermSchema = z.object({
  assinaturaData: z.string().regex(/^data:image\/png;base64,/).max(1000000),
});
const idSchema = z.string().uuid();

function sendOperationError(res: Response, error: unknown, fallback: string) {
  if (error instanceof TermOperationError) return res.status(error.statusCode).json({ message: error.message });
  return res.status(400).json({ message: error instanceof Error ? error.message : fallback });
}

export async function listAssignedTermsController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  try { return res.status(200).json(await listAssignedResponsibilityTerms(req.user.id)); }
  catch { return res.status(500).json({ message: 'Não foi possível carregar seus termos de responsabilidade.' }); }
}

export async function listIssuedTermsController(_req: Request, res: Response) {
  try { return res.status(200).json(await listIssuedResponsibilityTerms()); }
  catch { return res.status(500).json({ message: 'Não foi possível carregar os termos emitidos.' }); }
}

export async function createTermController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsed = createTermSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados do termo inválidos.', errors: parsed.error.flatten() });
  try { return res.status(201).json(await createResponsibilityTerm(req.user.id, parsed.data.usuarioDesignadoId, parsed.data.descricao)); }
  catch (error) { return sendOperationError(res, error, 'Não foi possível emitir o termo.'); }
}

export async function signTermController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsedId = idSchema.safeParse(req.params.termId);
  const parsedBody = signTermSchema.safeParse(req.body);
  if (!parsedId.success || !parsedBody.success) return res.status(400).json({ message: 'Identificador ou assinatura inválida.' });
  try { return res.status(200).json(await signResponsibilityTerm(req.user.id, parsedId.data, parsedBody.data.assinaturaData)); }
  catch (error) { return sendOperationError(res, error, 'Não foi possível assinar o termo.'); }
}

export async function deletePendingChecklistController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsedId = idSchema.safeParse(req.params.checklistId);
  if (!parsedId.success) return res.status(400).json({ message: 'Identificador de checklist inválido.' });
  try { return res.status(200).json(await deletePendingChecklist(parsedId.data, req.user.id)); }
  catch (error) { return sendOperationError(res, error, 'Não foi possível excluir a pendência.'); }
}
