import type { Request, Response } from 'express';
import { z } from 'zod';
import { cancelRemovalRoute, createRemovalRoute, getRemovalRoute, listRemovalRoutes } from './rotas.service.js';

const createRouteSchema = z.object({
  origem: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'Marque a localização atual no mapa.'),
  orderIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma ordem.').max(100, 'Uma rota pode ter até 100 paradas.'),
});

export async function createRemovalRouteController(req: Request, res: Response) {
  const parsed = createRouteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados da rota inválidos.', errors: parsed.error.flatten() });
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Usuário não autenticado.' });
  try { return res.status(201).json(await createRemovalRoute(userId, parsed.data.orderIds, parsed.data.origem)); }
  catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Não foi possível criar a rota.' }); }
}

export async function getRemovalRouteController(req: Request, res: Response) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const canViewAll = user.roles.some((role) => ['ADMIN', 'MASTER_ADMIN', 'SUPERVISOR', 'COORDENADOR', 'DIRETORIA'].includes(role));
  try { return res.status(200).json(await getRemovalRoute(req.params.routeId, user.id, canViewAll)); }
  catch (error) { return res.status(404).json({ message: error instanceof Error ? error.message : 'Rota não encontrada.' }); }
}

export async function listRemovalRoutesController(req: Request, res: Response) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const canViewAll = user.roles.some((role) => ['ADMIN', 'MASTER_ADMIN', 'SUPERVISOR', 'COORDENADOR', 'DIRETORIA'].includes(role));
  try { return res.status(200).json(await listRemovalRoutes(user.id, canViewAll)); }
  catch { return res.status(500).json({ message: 'Não foi possível carregar as rotas salvas.' }); }
}

export async function cancelRemovalRouteController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Usuário não autenticado.' });
  try { return res.status(200).json(await cancelRemovalRoute(req.params.routeId, userId)); }
  catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Não foi possível cancelar a rota.' }); }
}
