import { Router } from 'express';
import { z } from 'zod';
import { projectsController } from '../controllers/projects.controller.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, projectSchemas } from '../schemas/index.js';
import { ProjectRole } from '@pm-platform/db';

const router = Router();
const projectParams = z.object({ id });
const memberParams = z.object({ id, userId: id });

router.get('/', projectsController.list);
router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), validate({ body: projectSchemas.create }), auditLogger('project.create'), projectsController.create);
router.get('/:id', validate({ params: projectParams }), requireProjectRole(ProjectRole.VIEWER), projectsController.get);
router.patch('/:id', validate({ params: projectParams, body: projectSchemas.update }), requireProjectRole(ProjectRole.OWNER), auditLogger('project.update'), projectsController.update);
router.delete('/:id', validate({ params: projectParams }), requireProjectRole(ProjectRole.OWNER), auditLogger('project.archive'), projectsController.remove);
router.post('/:id/invite', validate({ params: projectParams, body: projectSchemas.invite }), requireProjectRole(ProjectRole.ADMIN), auditLogger('project.invite'), projectsController.invite);
router.get('/:id/members', validate({ params: projectParams }), requireProjectRole(ProjectRole.VIEWER), projectsController.members);
router.patch('/:id/members/:userId', validate({ params: memberParams, body: projectSchemas.member }), requireProjectRole(ProjectRole.ADMIN), auditLogger('project.member.update'), projectsController.updateMember);
router.delete('/:id/members/:userId', validate({ params: memberParams }), requireProjectRole(ProjectRole.ADMIN), auditLogger('project.member.remove'), projectsController.removeMember);

export default router;
