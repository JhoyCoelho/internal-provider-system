import { Router } from 'express';
import { requirePermissions, requireRole } from '../../middleware/rbacMiddleware.js';
import {
  approveChecklistController,
  createTemplateController,
  getChecklistHistoryController,
  listPendingApprovalsController,
  listMyPendingChecklistsController,
  listTemplatesController,
  rejectChecklistController,
  submitChecklistController,
  submitLateChecklistController,
} from './checklist.controller.js';

const router = Router();

router.get(
  '/templates',
  requirePermissions('CHECKLIST_READ'),
  listTemplatesController,
);

router.post(
  '/templates',
  requirePermissions('CHECKLIST_WRITE'),
  createTemplateController,
);

router.post(
  '/submit',
  requirePermissions('CHECKLIST_WRITE'),
  submitChecklistController,
);

router.post(
  '/submit-late',
  requirePermissions('CHECKLIST_WRITE'),
  submitLateChecklistController,
);

router.get(
  '/me',
  requirePermissions('CHECKLIST_READ'),
  getChecklistHistoryController,
);

router.get('/pendentes/me', requirePermissions('CHECKLIST_READ'), listMyPendingChecklistsController);

router.get(
  '/pendentes-aprovacao',
  requirePermissions('APPROVE_LATE_CHECKLIST'),
  listPendingApprovalsController,
);

router.patch(
  '/:checklistId/aprovar',
  requirePermissions('APPROVE_LATE_CHECKLIST'),
  approveChecklistController,
);

router.patch(
  '/:checklistId/reprovar',
  requirePermissions('APPROVE_LATE_CHECKLIST'),
  rejectChecklistController,
);

export default router;
