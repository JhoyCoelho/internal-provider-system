import type { Request, Response } from 'express';
import { Prisma, StatusUsuario } from '@prisma/client';
import { z } from 'zod';
import { createManagedUser, deleteManagedUser, listManagedUsers, updateManagedUser } from './usuarios.service.js';

const roleSchema = z.enum(['MASTER_ADMIN', 'ADMIN', 'TECNICO']);
const passwordSchema = z.string()
  .min(8, 'A senha deve conter pelo menos 8 caracteres.')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'A senha excede 72 bytes.');
const createUserSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160),
  password: passwordSchema,
  role: roleSchema,
});
const updateUserSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160),
  role: roleSchema,
  status: z.nativeEnum(StatusUsuario),
  password: passwordSchema.optional(),
});
const userIdSchema = z.string().uuid();

function isDuplicateEmail(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function listManagedUsersController(_req: Request, res: Response) {
  try {
    return res.status(200).json(await listManagedUsers());
  } catch {
    return res.status(500).json({ message: 'Não foi possível carregar os usuários.' });
  }
}

export async function createManagedUserController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados do usuário inválidos.', errors: parsed.error.flatten() });

  try {
    return res.status(201).json(await createManagedUser({ ...parsed.data, actorId: req.user.id }));
  } catch (error) {
    if (isDuplicateEmail(error)) return res.status(409).json({ message: 'Já existe um usuário com este e-mail.' });
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Não foi possível criar o usuário.' });
  }
}

export async function updateManagedUserController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsedId = userIdSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ message: 'Identificador de usuário inválido.' });
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados do usuário inválidos.', errors: parsed.error.flatten() });

  try {
    const user = await updateManagedUser(parsedId.data, { ...parsed.data, actorId: req.user.id });
    return user ? res.status(200).json(user) : res.status(404).json({ message: 'Usuário não encontrado.' });
  } catch (error) {
    if (isDuplicateEmail(error)) return res.status(409).json({ message: 'Já existe um usuário com este e-mail.' });
    if (isTransactionConflict(error)) return res.status(409).json({ message: 'Outro administrador alterou usuários ao mesmo tempo. Atualize a lista e tente novamente.' });
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.' });
  }
}

export async function deleteManagedUserController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsedId = userIdSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ message: 'Identificador de usuário inválido.' });

  try {
    const user = await deleteManagedUser(parsedId.data, req.user.id);
    return user ? res.status(200).json(user) : res.status(404).json({ message: 'Usuário não encontrado.' });
  } catch (error) {
    if (isTransactionConflict(error)) return res.status(409).json({ message: 'Outro administrador alterou usuários ao mesmo tempo. Atualize a lista e tente novamente.' });
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Não foi possível excluir o usuário.' });
  }
}