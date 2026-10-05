import type { Request, Response } from 'express';
import { z } from 'zod';
import { addObservation, assignTechnician, createOrder, getOrderById, listOrders, updateOrderStatus } from './remocao.service.js';

const querySchema = z.object({
  status: z.enum(['ABERTO', 'ROTEIRIZADO', 'CONCLUIDO', 'FALHA_TENTATIVA']).optional(),
  clienteNome: z.string().optional(), endereco: z.string().optional(), numero: z.string().optional(),
  bairro: z.string().optional(), pontoReferencia: z.string().optional(), regiao: z.string().optional(), tecnicoId: z.string().uuid().optional(),
});

const createOrderSchema = z.object({
  clienteNome: z.string().min(2, 'Cliente obrigatório.'), endereco: z.string().min(5, 'Endereço obrigatório.'),
  numero: z.string().min(1, 'Número obrigatório.'), bairro: z.string().min(2, 'Bairro obrigatório.'),
  pontoReferencia: z.string().min(2, 'Ponto de referência obrigatório.'), localizacao: z.string().min(2, 'Localização obrigatória.'),
  regiao: z.string().min(2, 'Região inválida.').optional(), equipamentoSerial: z.string().optional().nullable(),
  fotoFachadaUrl: z.string().optional().nullable(), telefoneContato: z.string().optional().nullable(), tecnicoId: z.string().uuid().optional().nullable(),
  status: z.enum(['ABERTO', 'ROTEIRIZADO', 'CONCLUIDO', 'FALHA_TENTATIVA']).optional(),
}).superRefine((data, context) => {
  if (data.telefoneContato && data.telefoneContato.replace(/\D/g, '').length !== 11) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['telefoneContato'], message: 'Telefone deve conter 11 dígitos.' });
  }
  if (data.equipamentoSerial && !/^[A-Za-z0-9]{12}$/.test(data.equipamentoSerial)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['equipamentoSerial'], message: 'Serial deve conter 12 caracteres alfanuméricos.' });
  }
  if (!/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(data.localizacao)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['localizacao'], message: 'Selecione uma localização no mapa.' });
  }
});

const updateStatusSchema = z.object({
  status: z.enum(['ABERTO', 'ROTEIRIZADO', 'CONCLUIDO', 'FALHA_TENTATIVA']),
  substatusFalha: z.enum(['CLIENTE_AUSENTE', 'RECUSA', 'MUDOU_SE', 'ENDERECO_NAO_LOCALIZADO']).optional().nullable(),
  fotoSerialUrl: z.string().min(1).optional().nullable(), fotoFachadaUrl: z.string().min(1).optional().nullable(),
});

const observationSchema = z.object({ texto: z.string().min(2, 'Observação obrigatória.') });

export async function listOrdersController(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Parâmetros inválidos.', errors: parsed.error.flatten() });
  try { return res.status(200).json(await listOrders(parsed.data)); } catch { return res.status(500).json({ message: 'Erro ao listar remoções.' }); }
}

export async function getOrderController(req: Request, res: Response) {
  try {
    const order = await getOrderById(req.params.id);
    return order ? res.status(200).json(order) : res.status(404).json({ message: 'Remoção não encontrada.' });
  } catch { return res.status(500).json({ message: 'Erro ao buscar remoção.' }); }
}

export async function createOrderController(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados inválidos.', errors: parsed.error.flatten() });
  try { return res.status(201).json(await createOrder({ ...parsed.data, criadoPorId: req.user?.id })); } catch { return res.status(500).json({ message: 'Erro ao criar remoção.' }); }
}

export async function assignTechnicianController(req: Request, res: Response) {
  if (!req.body.tecnicoId) return res.status(400).json({ message: 'Campo técnico é obrigatório.' });
  try { return res.status(200).json(await assignTechnician(req.params.id, req.body.tecnicoId)); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atribuir técnico.' }); }
}

export async function updateStatusController(req: Request, res: Response) {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados de status inválidos.', errors: parsed.error.flatten() });
  try { return res.status(200).json(await updateOrderStatus(req.params.id, parsed.data)); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar status.' }); }
}

export async function addObservationController(req: Request, res: Response) {
  const parsed = observationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Observação inválida.', errors: parsed.error.flatten() });
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  try { return res.status(201).json(await addObservation(req.params.id, req.user.id, parsed.data.texto)); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao registrar observação.' }); }
}
