import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { sprintsController } from '../controllers/sprints.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { id, sprintSchemas } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const sprintParams = z.object({ projectId: id, sprintId: id });
const projectParams = z.object({ projectId: id });

router.get('/', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams }), sprintsController.list);
router.post('/', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams, body: sprintSchemas.create }), auditLogger('sprint.create'), sprintsController.create);
router.get('/velocity', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams }), sprintsController.velocity);
router.get('/:sprintId', requireProjectRole(ProjectRole.MEMBER), validate({ params: sprintParams }), sprintsController.get);
router.patch('/:sprintId', requireProjectRole(ProjectRole.ADMIN), validate({ params: sprintParams, body: sprintSchemas.update }), auditLogger('sprint.update'), sprintsController.update);
router.post('/:sprintId/start', requireProjectRole(ProjectRole.ADMIN), validate({ params: sprintParams }), auditLogger('sprint.start'), sprintsController.start);
router.post('/:sprintId/complete', requireProjectRole(ProjectRole.ADMIN), validate({ params: sprintParams, body: sprintSchemas.complete }), auditLogger('sprint.complete'), sprintsController.complete);
router.delete('/:sprintId', requireProjectRole(ProjectRole.ADMIN), validate({ params: sprintParams }), auditLogger('sprint.delete'), sprintsController.remove);
router.get('/:sprintId/burndown', requireProjectRole(ProjectRole.MEMBER), validate({ params: sprintParams }), sprintsController.burndown);

export default router;
