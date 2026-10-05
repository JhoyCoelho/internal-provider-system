import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbacMiddleware.js';
import { addObservationController, assignTechnicianController, createOrderController, getOrderController, listOrdersController, updateStatusController } from './remocao.controller.js';

const router = Router();
router.get('/', requirePermissions('ORDERS_READ'), listOrdersController);
router.get('/:id', requirePermissions('ORDERS_READ'), getOrderController);
router.post('/', requirePermissions('ORDERS_WRITE'), createOrderController);
router.patch('/:id/atribuir-tecnico', requirePermissions('ORDERS_WRITE'), assignTechnicianController);
router.patch('/:id/status', requirePermissions('ORDERS_STATUS_WRITE'), updateStatusController);
router.post('/:id/observacoes', requirePermissions('ORDERS_NOTE_WRITE'), addObservationController);
export default router;
