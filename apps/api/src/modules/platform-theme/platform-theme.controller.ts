import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const themeSchema = z.object({
  brandPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  brandAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  pageBackground: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  surfaceBackground: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
});

const themeSelect = {
  brandPrimary: true,
  brandAccent: true,
  pageBackground: true,
  surfaceBackground: true,
  updatedAt: true,
} as const;

const defaultTheme = {
  brandPrimary: '#1d4ed8',
  brandAccent: '#0f766e',
  pageBackground: '#f8fafc',
  surfaceBackground: '#ffffff',
};

function relativeLuminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const luminance = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (luminance[0] + 0.05) / (luminance[1] + 0.05);
}

export async function getPlatformThemeController(_req: Request, res: Response) {
  try {
    const theme = await prisma.configuracaoPlataforma.findUnique({ where: { id: 1 }, select: themeSelect });
    return res.status(200).json(theme ?? defaultTheme);
  } catch {
    return res.status(503).json({ message: 'Não foi possível carregar as cores da plataforma.' });
  }
}

export async function updatePlatformThemeController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsed = themeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Cores inválidas.', errors: parsed.error.flatten() });
  const theme = parsed.data;
  if (contrastRatio(theme.brandPrimary, '#ffffff') < 4.5 || contrastRatio(theme.brandAccent, '#ffffff') < 4.5) {
    return res.status(400).json({ message: 'As cores principal e de destaque precisam manter contraste mínimo com texto claro.' });
  }
  if (contrastRatio(theme.pageBackground, '#0f172a') < 4.5 || contrastRatio(theme.surfaceBackground, '#0f172a') < 4.5) {
    return res.status(400).json({ message: 'Fundo e painéis precisam manter contraste mínimo com texto escuro.' });
  }

  try {
    const theme = await prisma.$transaction(async (transaction) => {
      const previous = await transaction.configuracaoPlataforma.findUnique({ where: { id: 1 }, select: themeSelect });
      const updated = await transaction.configuracaoPlataforma.upsert({
        where: { id: 1 },
        update: parsed.data,
        create: { id: 1, ...parsed.data },
        select: themeSelect,
      });
      await transaction.logAuditoria.create({
        data: {
          usuarioId: req.user!.id,
          acao: 'CORES_PLATAFORMA_ATUALIZADAS',
          entidade: 'CONFIGURACAO_PLATAFORMA',
          entidadeId: '1',
          valorAntigo: previous ? {
            brandPrimary: previous.brandPrimary,
            brandAccent: previous.brandAccent,
            pageBackground: previous.pageBackground,
            surfaceBackground: previous.surfaceBackground,
          } : Prisma.JsonNull,
          valorNovo: parsed.data,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 255),
        },
      });
      return updated;
    });
    return res.status(200).json(theme);
  } catch {
    return res.status(503).json({ message: 'Não foi possível salvar as cores da plataforma.' });
  }
}