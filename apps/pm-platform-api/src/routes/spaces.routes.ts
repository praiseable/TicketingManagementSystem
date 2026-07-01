import { Router } from 'express';
import { z } from 'zod';
import { spacesController } from '../controllers/spaces.controller.js';
import { pagesController } from '../controllers/pages.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, spaceSchemas } from '../schemas/index.js';

const router = Router();

router.get('/shared/:token', pagesController.shared);
router.get('/', spacesController.list);
router.post('/', validate({ body: spaceSchemas.create }), auditLogger('space.create'), spacesController.create);
router.get('/:spaceId', validate({ params: z.object({ spaceId: id }) }), spacesController.get);
router.patch('/:spaceId', validate({ params: z.object({ spaceId: id }), body: spaceSchemas.update }), auditLogger('space.update'), spacesController.update);
router.delete('/:spaceId', validate({ params: z.object({ spaceId: id }) }), auditLogger('space.delete'), spacesController.remove);
router.get('/:spaceId/members', validate({ params: z.object({ spaceId: id }) }), spacesController.members);
router.post('/:spaceId/members', validate({ params: z.object({ spaceId: id }), body: z.object({ email: z.string().email(), role: z.enum(['OWNER', 'EDITOR', 'VIEWER']).default('VIEWER') }) }), auditLogger('space.member.add'), spacesController.addMember);
router.patch('/:spaceId/members/:memberId', validate({ params: z.object({ spaceId: id, memberId: id }), body: z.object({ role: z.enum(['OWNER', 'EDITOR', 'VIEWER']) }) }), auditLogger('space.member.update'), spacesController.updateMember);
router.delete('/:spaceId/members/:memberId', validate({ params: z.object({ spaceId: id, memberId: id }) }), auditLogger('space.member.delete'), spacesController.removeMember);

export default router;
