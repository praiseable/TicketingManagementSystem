import { Router } from 'express';
import { z } from 'zod';
import { adminController } from '../controllers/admin.controller.js';
import { requireAtLeast } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { id, paginationQuery } from '../schemas/index.js';

const router = Router();

const userQuery = paginationQuery.extend({
  q: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER']).optional(),
  isActive: z.union([z.string(), z.boolean()]).optional()
}).passthrough();

const auditQuery = paginationQuery.extend({
  q: z.string().optional(),
  userId: id.optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional()
}).passthrough();

router.use(requireAtLeast('ADMIN'));
router.get('/users', validate({ query: userQuery }), adminController.users);
router.patch('/users/:id/activate', validate({ params: z.object({ id }) }), adminController.activate);
router.patch('/users/:id/deactivate', validate({ params: z.object({ id }) }), adminController.deactivate);
router.patch('/users/:id/role', validate({ params: z.object({ id }), body: z.object({ role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER']) }) }), adminController.role);
router.patch('/users/:id/password', validate({ params: z.object({ id }), body: z.object({ password: z.string().min(8).optional() }) }), adminController.resetPassword);
router.get('/audit-log', validate({ query: auditQuery }), adminController.audit);
router.get('/stats', adminController.stats);

export default router;
