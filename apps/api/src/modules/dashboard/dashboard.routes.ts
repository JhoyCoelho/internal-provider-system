import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbacMiddleware.js';
import { dashboardSummaryController, resolveChecklistResponseController } from './dashboard.controller.js';

const router = Router();
router.get('/', requirePermissions({ anyOf: ['REPORTS_READ', 'ORDERS_READ', 'CHECKLIST_READ'] }), dashboardSummaryController);
router.patch('/checklist-responses/:responseId/resolve', requirePermissions('CHECKLIST_WRITE'), resolveChecklistResponseController);
export default router;
