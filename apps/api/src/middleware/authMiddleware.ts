import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.isp_session as string | undefined;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({
      message: 'Sessão ausente ou expirada. Entre novamente.',
    });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({
      message: 'Token inválido ou expirado.',
    });
  }

  let user;
  try {
    user = await prisma.usuario.findFirst({
      where: { id: payload.sub, status: 'ATIVO' },
      include: {
        roles: {
          where: { perfil: { is: { active: true } } },
          include: { perfil: { include: { permissoes: { include: { permissao: true } } } } },
        },
      },
    });
  } catch (error) {
    return next(error);
  }

  if (!user) return res.status(401).json({ message: 'Sessão inválida ou usuário desativado.' });

  req.user = {
    id: user.id,
    email: user.email,
    roles: user.roles.map((relation) => String(relation.perfil.code)),
    permissions: user.roles.flatMap((relation) => relation.perfil.permissoes.map((item) => String(item.permissao.code))),
  };

  return next();
}
