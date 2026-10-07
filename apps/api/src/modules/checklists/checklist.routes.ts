import { Router } from 'express';
import { requirePermissions, requireRole } from '../../middleware/rbacMiddleware.js';
import {
  approveChecklistController,
  createTemplateController,
  getChecklistHistoryController,
  listPendingApprovalsController,
  listChecklistReportController,
  listMyPendingChecklistsController,
  listTemplatesController,
  rejectChecklistController,
  submitChecklistController,
  submitLateChecklistController,
} from './checklist.controller.js';

const router = Router();

router.get(
  '/templates',
  requireRole('TECNICO'),
  requirePermissions('CHECKLIST_READ'),
  listTemplatesController,
);

router.post(
  '/templates',
  requireRole('MASTER_ADMIN'),
  requirePermissions('CHECKLIST_WRITE'),
  createTemplateController,
);

router.post(
  '/submit',
  requireRole('TECNICO'),
  requirePermissions('CHECKLIST_WRITE'),
  submitChecklistController,
);

router.post(
  '/submit-late',
  requireRole('TECNICO'),
  requirePermissions('CHECKLIST_WRITE'),
  submitLateChecklistController,
);

router.get(
  '/me',
  requireRole('TECNICO'),
  requirePermissions('CHECKLIST_READ'),
  getChecklistHistoryController,
);

router.get('/relatorio', requireRole('MASTER_ADMIN'), requirePermissions('APPROVE_LATE_CHECKLIST'), listChecklistReportController);

router.get('/pendentes/me', requireRole('TECNICO'), requirePermissions('CHECKLIST_READ'), listMyPendingChecklistsController);

router.get(
  '/pendentes-aprovacao',
  requireRole('MASTER_ADMIN'),
  requirePermissions('APPROVE_LATE_CHECKLIST'),
  listPendingApprovalsController,
);

router.patch(
  '/:checklistId/aprovar',
  requireRole('MASTER_ADMIN'),
  requirePermissions('APPROVE_LATE_CHECKLIST'),
  approveChecklistController,
);

router.patch(
  '/:checklistId/reprovar',
  requireRole('MASTER_ADMIN'),
  requirePermissions('APPROVE_LATE_CHECKLIST'),
  rejectChecklistController,
);

export default router;
