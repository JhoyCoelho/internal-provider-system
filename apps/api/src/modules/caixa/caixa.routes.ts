import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbacMiddleware.js';
import {
  approvalCashClosureController,
  closeCashTurnController,
  getCashTurnController,
  getOpenCashTurnController,
  listCashHistoryController,
  openCashTurnController,
} from './caixa.controller.js';

const router = Router();

router.post(
  '/abrir-turno',
  requirePermissions('CASH_WRITE'),
  openCashTurnController,
);

router.get(
  '/turno-aberto',
  requirePermissions('CASH_READ'),
  getOpenCashTurnController,
);

router.post(
  '/fechar-turno',
  requirePermissions('CASH_WRITE'),
  closeCashTurnController,
);

router.get(
  '/historico',
  requirePermissions('CASH_READ'),
  listCashHistoryController,
);

router.get(
  '/:turnoId',
  requirePermissions('CASH_READ'),
  getCashTurnController,
);

router.patch(
  '/:turnoId/aprovar',
  requirePermissions('APPROVE_CLOSURE'),
  approvalCashClosureController,
);

export default router;
