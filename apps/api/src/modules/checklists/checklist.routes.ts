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
import {
  createTermController,
  deletePendingChecklistController,
  listAssignedTermsController,
  listIssuedTermsController,
  signTermController,
} from './termos.controller.js';

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

router.get('/termos/me', listAssignedTermsController);
router.get('/termos/emitidos', requireRole('MASTER_ADMIN'), listIssuedTermsController);
router.post('/termos', requireRole('MASTER_ADMIN'), requirePermissions('CHECKLIST_WRITE'), createTermController);
router.post('/termos/:termId/assinar', signTermController);
router.delete('/:checklistId', requireRole('MASTER_ADMIN'), requirePermissions('CHECKLIST_WRITE'), deletePendingChecklistController);

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
