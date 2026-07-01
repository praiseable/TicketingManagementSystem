import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { githubController } from '../controllers/github.controller.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { validate } from '../middleware/validate.js';
import { id } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const issueParams = z.object({ projectId: id, issueId: id });

router.post('/commits', requireProjectRole(ProjectRole.MEMBER), auditLogger('github.commits.link'), githubController.receiveCommits);
router.get('/issues/:issueId/commits', validate({ params: issueParams }), requireProjectRole(ProjectRole.VIEWER), githubController.issueCommits);

export default router;
