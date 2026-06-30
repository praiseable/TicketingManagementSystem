import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { backlogsController } from '../controllers/backlogs.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { backlogSchemas, id } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ projectId: id });

router.get('/', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams }), backlogsController.list);
router.patch('/reorder', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams, body: backlogSchemas.reorder }), auditLogger('backlog.reorder'), backlogsController.reorder);
router.post('/move-to-sprint', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams, body: backlogSchemas.moveToSprint }), auditLogger('backlog.moveToSprint'), backlogsController.moveToSprint);

export default router;
