import { Router } from 'express';
import { requirePermissions, requireRole } from '../../middleware/rbacMiddleware.js';
import { addObservationController, assignTechnicianController, createOrderController, deleteOrderController, getOrderController, listOrdersController, updateStatusController } from './remocao.controller.js';
import { cancelRemovalRouteController, createRemovalRouteController, getRemovalRouteController, listRemovalRoutesController } from './rotas.controller.js';

const router = Router();
router.post('/rotas', requirePermissions({ anyOf: ['ORDERS_STATUS_WRITE', 'ORDERS_WRITE'] }), createRemovalRouteController);
router.get('/rotas', requirePermissions('ORDERS_READ'), listRemovalRoutesController);
router.patch('/rotas/:routeId/cancelar', requireRole('ADMIN', 'MASTER_ADMIN'), cancelRemovalRouteController);
router.get('/rotas/:routeId', requirePermissions('ORDERS_READ'), getRemovalRouteController);
router.get('/', requirePermissions('ORDERS_READ'), listOrdersController);
router.get('/:id', requirePermissions('ORDERS_READ'), getOrderController);
router.delete('/:id', requireRole('MASTER_ADMIN'), deleteOrderController);
router.post('/', requirePermissions('ORDERS_WRITE'), createOrderController);
router.patch('/:id/atribuir-tecnico', requirePermissions('ORDERS_WRITE'), assignTechnicianController);
router.patch('/:id/status', requirePermissions('ORDERS_STATUS_WRITE'), updateStatusController);
router.post('/:id/observacoes', requirePermissions('ORDERS_NOTE_WRITE'), addObservationController);
export default router;
