import { Router } from 'express';
import { requireRole } from '../../middleware/rbacMiddleware.js';
import {
  getAuditFilterOptionsController,
  getAuditLogController,
  listAuditLogsController,
} from './auditoria.controller.js';

const router = Router();

router.get(
  '/filtros',
  requireRole('MASTER_ADMIN'),
  getAuditFilterOptionsController,
);

router.get(
  '/',
  requireRole('MASTER_ADMIN'),
  listAuditLogsController,
);

router.get(
  '/:id',
  requireRole('MASTER_ADMIN'),
  getAuditLogController,
);

export default router;
