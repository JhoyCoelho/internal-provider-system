import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbacMiddleware.js';
import {
  getAuditLogController,
  listAuditLogsController,
} from './auditoria.controller.js';

const router = Router();

router.get(
  '/',
  requirePermissions('AUDIT_READ'),
  listAuditLogsController,
);

router.get(
  '/:id',
  requirePermissions('AUDIT_READ'),
  getAuditLogController,
);

export default router;
