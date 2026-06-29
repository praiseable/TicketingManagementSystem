import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { issuesController } from '../controllers/issues.controller.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, issueSchemas } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ projectId: id }).passthrough();
const issueParams = z.object({ projectId: id, issueId: id }).passthrough();

router.post('/bulk', requireProjectRole(ProjectRole.MEMBER), validate({ body: issueSchemas.bulk }), auditLogger('issue.bulk'), issuesController.bulk);

// Board/list route: do not Zod-validate query or params here.
// requireProjectRole resolves + injects projectId, and issueService clamps page/limit.
router.get('/', requireProjectRole(ProjectRole.MEMBER), issuesController.list);

router.post('/', requireProjectRole(ProjectRole.MEMBER), validate({ params: projectParams, body: issueSchemas.create }), auditLogger('issue.create'), issuesController.create);
router.get('/:issueId', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams }), issuesController.get);
router.patch('/:issueId', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams, body: issueSchemas.update }), auditLogger('issue.update'), issuesController.update);
router.delete('/:issueId', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams }), auditLogger('issue.delete'), issuesController.remove);
router.post('/:issueId/transition', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams, body: issueSchemas.transition }), auditLogger('issue.transition'), issuesController.transition);
router.post('/:issueId/link', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams, body: issueSchemas.link }), auditLogger('issue.link'), issuesController.link);
router.delete('/:issueId/link/:linkId', requireProjectRole(ProjectRole.MEMBER), validate({ params: z.object({ projectId: id, issueId: id, linkId: id }).passthrough() }), auditLogger('issue.unlink'), issuesController.unlink);
router.get('/:issueId/history', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams }), issuesController.history);
router.post('/:issueId/watch', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams }), auditLogger('issue.watch'), issuesController.watch);
router.delete('/:issueId/watch', requireProjectRole(ProjectRole.MEMBER), validate({ params: issueParams }), auditLogger('issue.unwatch'), issuesController.unwatch);

export default router;
