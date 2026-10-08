import { Router } from 'express';
import { requireRole } from '../../middleware/rbacMiddleware.js';
import { createManagedUserController, deleteManagedUserController, listManagedUsersController, updateManagedUserController } from './usuarios.controller.js';

const router = Router();
router.use(requireRole('MASTER_ADMIN'));
router.get('/', listManagedUsersController);
router.post('/', createManagedUserController);
router.patch('/:id', updateManagedUserController);
router.delete('/:id', deleteManagedUserController);

export default router;