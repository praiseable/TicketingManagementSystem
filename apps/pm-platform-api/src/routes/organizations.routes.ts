import { Router } from 'express';
import { z } from 'zod';
import { organizationsController } from '../controllers/organizations.controller.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id } from '../schemas/index.js';

const router = Router();

router.get('/', organizationsController.get);
router.patch(
  '/',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate({ body: z.object({ name: z.string().min(2).optional(), logoUrl: z.string().url().nullable().optional(), settings: z.record(z.unknown()).optional() }) }),
  auditLogger('org.update'),
  organizationsController.update
);
router.get('/members', requireRole('ADMIN', 'SUPER_ADMIN'), organizationsController.members);
router.delete('/members/:userId', requireRole('ADMIN', 'SUPER_ADMIN'), validate({ params: z.object({ userId: id }) }), auditLogger('org.member.remove'), organizationsController.removeMember);

export default router;
