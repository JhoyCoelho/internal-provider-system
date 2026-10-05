import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import remocaoRoutes from './modules/ordens-remocao/remocao.routes.js';
import checklistRoutes from './modules/checklists/checklist.routes.js';
import caixaRoutes from './modules/caixa/caixa.routes.js';
import auditoriaRoutes from './modules/auditoria/auditoria.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY === 'true' ? 1 : false);
  const allowedOrigins = new Set(env.WEB_ORIGINS.split(',').map((origin) => origin.trim().replace(/\/$/, '')));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));
  app.use(helmet());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (env.NODE_ENV === 'production') {
    morgan.token('safe-path', (req) => req.url?.split('?')[0] ?? '/');
    app.use(morgan(':method :safe-path :status :response-time ms'));
  } else {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req, res) => {
    void prisma.$queryRaw`SELECT 1`
      .then(() => res.status(200).json({ ok: true, service: 'sistema-interno-api', database: 'ready' }))
      .catch(() => res.status(503).json({ ok: false, service: 'sistema-interno-api', database: 'unavailable' }));
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    return next();
  });

  app.use('/api', (req, res, next) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const hasSessionCookie = Boolean(req.cookies?.isp_session);
    const origin = req.get('origin')?.replace(/\/$/, '');
    if (isMutation && hasSessionCookie && (!origin || !allowedOrigins.has(origin))) {
      return res.status(403).json({ message: 'Origem não autorizada para esta ação.' });
    }
    return next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', authenticateToken);
  app.use('/api/ordens-remocao', remocaoRoutes);
  app.use('/api/checklists', checklistRoutes);
  app.use('/api/caixa', caixaRoutes);
  app.use('/api/auditoria', auditoriaRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.get('/api/me', (req, res) => {
    res.status(200).json({ user: req.user });
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
      return res.status(413).json({ message: 'A imagem excede o limite de 5 MB. Selecione uma imagem menor.' });
    }
    return next(error);
  });

  return app;
}
