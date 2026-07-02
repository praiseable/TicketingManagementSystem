import { Router } from 'express';
import { z } from 'zod';
import { adminController } from '../controllers/admin.controller.js';
import { groupsController } from '../controllers/groups.controller.js';
import { requireAtLeast } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { id, paginationQuery } from '../schemas/index.js';

const router = Router();

const userQuery = paginationQuery.extend({
  q: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER']).optional(),
  isActive: z.union([z.string(), z.boolean()]).optional()
}).passthrough();

const groupParams = z.object({ groupId: z.string().min(6) }).passthrough();
const groupUserParams = z.object({ groupId: z.string().min(6), userId: id }).passthrough();
const groupBody = z.object({ name: z.string().min(2), description: z.string().optional() }).passthrough();
const groupUserBody = z.object({ userId: id }).passthrough();

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
router.get('/groups', groupsController.list);
router.post('/groups', validate({ body: groupBody }), groupsController.create);
router.post('/groups/:groupId/users', validate({ params: groupParams, body: groupUserBody }), groupsController.addUser);
router.delete('/groups/:groupId/users/:userId', validate({ params: groupUserParams }), groupsController.removeUser);
router.delete('/groups/:groupId', validate({ params: groupParams }), groupsController.remove);
router.get('/users', validate({ query: userQuery }), adminController.users);
router.patch('/users/:id/activate', validate({ params: z.object({ id }) }), adminController.activate);
router.patch('/users/:id/deactivate', validate({ params: z.object({ id }) }), adminController.deactivate);
router.patch('/users/:id/role', validate({ params: z.object({ id }), body: z.object({ role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER']) }) }), adminController.role);
router.patch('/users/:id/password', validate({ params: z.object({ id }), body: z.object({ password: z.string().min(8).optional() }) }), adminController.resetPassword);
router.get('/audit-log', validate({ query: auditQuery }), adminController.audit);
router.get('/stats', adminController.stats);

export default router;
