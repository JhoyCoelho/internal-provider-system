import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { signToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
const sessionCookieName = 'isp_session';
const sessionCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  path: '/',
};
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(8, 'Senha deve conter pelo menos 8 caracteres.')
    .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Senha excede o tamanho máximo aceito pelo algoritmo de hash.'),
});

router.post('/login', loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados inválidos.', errors: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  try {
    const user = await prisma.usuario.findUnique({
    where: { email },
    include: {
      roles: {
        where: { perfil: { is: { active: true } } },
        include: {
          perfil: {
            include: { permissoes: { include: { permissao: true } } },
          },
        },
      },
    },
    });

    if (!user || user.status !== 'ATIVO') {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const roles = user.roles.map((relation) => String(relation.perfil.code));
    const permissions = user.roles.flatMap((relation) => relation.perfil.permissoes.map((item) => String(item.permissao.code)));
    const token = signToken({
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      passwordVersion: user.passwordChangedAt?.getTime() ?? 0,
    });
    const userPayload = { id: user.id, nome: user.nome, email: user.email, roles, permissions };

    res.cookie(sessionCookieName, token, { ...sessionCookieOptions, maxAge: 4 * 60 * 60 * 1000 });
    return res.status(200).json({ user: userPayload });
  } catch {
    return res.status(503).json({ message: 'Serviço de autenticação temporariamente indisponível.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(sessionCookieName, sessionCookieOptions);
  return res.status(204).end();
});

export default router;
