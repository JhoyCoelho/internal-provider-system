import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const themeSchema = z.object({
  providerName: z.string().trim().min(2).max(120),
  logoDataUrl: z.string().max(1_400_000).nullable(),
  brandPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  brandAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  pageBackground: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  surfaceBackground: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  textPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
  textSecondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use um código HEX no formato #RRGGBB.'),
});

const themeSelect = {
  providerName: true,
  logoDataUrl: true,
  brandPrimary: true,
  brandAccent: true,
  pageBackground: true,
  surfaceBackground: true,
  textPrimary: true,
  textSecondary: true,
  updatedAt: true,
} as const;

const defaultTheme = {
  providerName: 'Fyberlink',
  logoDataUrl: null,
  brandPrimary: '#1d4ed8',
  brandAccent: '#0f766e',
  pageBackground: '#f8fafc',
  surfaceBackground: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
};

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isValidPngDataUrl(value: string | null) {
  if (value === null) return true;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const image = Buffer.from(match[1], 'base64');
  return image.length <= 1_000_000
    && image.toString('base64') === match[1]
    && image.subarray(0, pngSignature.length).equals(pngSignature);
}

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
    return res.status(503).json({ message: 'Não foi possível carregar a personalização da plataforma.' });
  }
}

export async function updatePlatformThemeController(req: Request, res: Response) {
  if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
  const parsed = themeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados de personalização inválidos.', errors: parsed.error.flatten() });
  const theme = parsed.data;
  if (!isValidPngDataUrl(theme.logoDataUrl)) {
    return res.status(400).json({ message: 'Envie uma imagem PNG válida de até 1 MB.' });
  }
  if (contrastRatio(theme.brandPrimary, '#ffffff') < 4.5 || contrastRatio(theme.brandAccent, '#ffffff') < 4.5) {
    return res.status(400).json({ message: 'As cores principal e de destaque precisam manter contraste mínimo com texto claro.' });
  }
  const textColors = [theme.textPrimary, theme.textSecondary];
  const backgrounds = [theme.pageBackground, theme.surfaceBackground];
  if (textColors.some((textColor) => backgrounds.some((background) => contrastRatio(textColor, background) < 4.5))) {
    return res.status(400).json({ message: 'As cores das fontes precisam manter contraste mínimo de 4,5:1 com os fundos.' });
  }

  try {
    const theme = await prisma.$transaction(async (transaction) => {
      const previous = await transaction.configuracaoPlataforma.findUnique({
        where: { id: 1 },
        select: {
          providerName: true,
          brandPrimary: true,
          brandAccent: true,
          pageBackground: true,
          surfaceBackground: true,
          textPrimary: true,
          textSecondary: true,
        },
      });
      const updated = await transaction.configuracaoPlataforma.upsert({
        where: { id: 1 },
        update: parsed.data,
        create: { id: 1, ...parsed.data },
        select: themeSelect,
      });
      await transaction.logAuditoria.create({
        data: {
          usuarioId: req.user!.id,
          autorMasterAdmin: true,
          acao: 'CUSTOMIZACAO_PLATAFORMA_ATUALIZADA',
          entidade: 'CONFIGURACAO_PLATAFORMA',
          entidadeId: '1',
          valorAntigo: previous ? {
            providerName: previous.providerName,
            brandPrimary: previous.brandPrimary,
            brandAccent: previous.brandAccent,
            pageBackground: previous.pageBackground,
            surfaceBackground: previous.surfaceBackground,
            textPrimary: previous.textPrimary,
            textSecondary: previous.textSecondary,
          } : Prisma.JsonNull,
          valorNovo: {
            providerName: parsed.data.providerName,
            brandPrimary: parsed.data.brandPrimary,
            brandAccent: parsed.data.brandAccent,
            pageBackground: parsed.data.pageBackground,
            surfaceBackground: parsed.data.surfaceBackground,
            textPrimary: parsed.data.textPrimary,
            textSecondary: parsed.data.textSecondary,
            logoConfigured: Boolean(parsed.data.logoDataUrl),
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 255),
        },
      });
      return updated;
    });
    return res.status(200).json(theme);
  } catch {
    return res.status(503).json({ message: 'Não foi possível salvar a personalização da plataforma.' });
  }
}