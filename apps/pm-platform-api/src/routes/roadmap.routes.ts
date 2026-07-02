import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { roadmapController } from '../controllers/roadmap.controller.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { validate } from '../middleware/validate.js';
import { id } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ projectId: id }).passthrough();
const issueParams = z.object({ projectId: id, issueId: id }).passthrough();

router.get('/', requireProjectRole(ProjectRole.VIEWER), validate({ params: projectParams }), roadmapController.timeline);
router.patch('/issues/:issueId/reschedule', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams, body: z.object({ startDate: z.string(), endDate: z.string() }) }), roadmapController.reschedule);

export default router;
