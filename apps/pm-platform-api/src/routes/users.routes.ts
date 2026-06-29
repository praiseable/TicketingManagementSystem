import { Router } from 'express';
import { z } from 'zod';
import { usersController } from '../controllers/users.controller.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, paginationQuery, userSchemas } from '../schemas/index.js';

const router = Router();
router.get('/', requireRole('ADMIN', 'SUPER_ADMIN'), validate({ query: paginationQuery }), usersController.list);
router.get('/:id', validate({ params: z.object({ id }) }), usersController.get);
router.patch('/:id', validate({ params: z.object({ id }), body: userSchemas.update }), auditLogger('user.update'), usersController.update);
router.patch('/:id/password', validate({ params: z.object({ id }), body: userSchemas.password }), auditLogger('user.password'), usersController.password);
router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), validate({ params: z.object({ id }) }), auditLogger('user.deactivate'), usersController.remove);
export default router;
