import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres.'),
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida.'),
  WEB_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

const parsedEnv = envSchema.parse(process.env);

if (parsedEnv.NODE_ENV === 'production') {
  if (!parsedEnv.WEB_ORIGINS?.trim()) {
    throw new Error('WEB_ORIGINS é obrigatório em produção e deve conter a origem HTTPS do frontend.');
  }
  if (/troque|placeholder|change.?me|example|local_only|random_secret/i.test(parsedEnv.JWT_SECRET)) {
    throw new Error('JWT_SECRET de produção não pode ser um valor de exemplo.');
  }
  if (parsedEnv.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET de produção deve conter pelo menos 64 caracteres aleatórios.');
  }
  if (parsedEnv.WEB_ORIGINS.split(',').some((origin) => !origin.trim().startsWith('https://'))) {
    throw new Error('WEB_ORIGINS em produção deve conter apenas origens HTTPS.');
  }
}

export const env = {
  ...parsedEnv,
  WEB_ORIGINS: parsedEnv.WEB_ORIGINS ?? 'http://localhost:3000',
};
