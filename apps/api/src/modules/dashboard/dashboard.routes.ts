import { Router } from 'express';
import { requirePermissions, requireRole } from '../../middleware/rbacMiddleware.js';
import { dashboardSummaryController, resolveChecklistResponseController } from './dashboard.controller.js';

const router = Router();
router.get('/', requirePermissions({ anyOf: ['REPORTS_READ', 'ORDERS_READ', 'CHECKLIST_READ'] }), dashboardSummaryController);
router.patch('/checklist-responses/:responseId/resolve', requireRole('MASTER_ADMIN'), requirePermissions('CHECKLIST_WRITE'), resolveChecklistResponseController);
export default router;
