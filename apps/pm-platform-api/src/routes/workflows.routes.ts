import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { workflowsController } from '../controllers/workflows.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { id, workflowSchemas } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ projectId: id }).passthrough();
const workflowParams = z.object({ projectId: id, wfId: id }).passthrough();
const statusParams = z.object({ projectId: id, wfId: id, sId: id }).passthrough();
const transitionParams = z.object({ projectId: id, wfId: id, tId: id }).passthrough();
const guardParams = z.object({ projectId: id, wfId: id, tId: id, gId: id }).passthrough();

router.get('/', requireProjectRole(ProjectRole.VIEWER), validate({ params: projectParams }), workflowsController.list);
router.post('/', requireProjectRole(ProjectRole.ADMIN), validate({ params: projectParams, body: workflowSchemas.workflow }), auditLogger('workflow.create'), workflowsController.create);
router.get('/:wfId', requireProjectRole(ProjectRole.VIEWER), validate({ params: workflowParams }), workflowsController.get);
router.patch('/:wfId', requireProjectRole(ProjectRole.ADMIN), validate({ params: workflowParams, body: workflowSchemas.workflow.partial() }), auditLogger('workflow.update'), workflowsController.update);
router.delete('/:wfId', requireProjectRole(ProjectRole.ADMIN), validate({ params: workflowParams }), auditLogger('workflow.delete'), workflowsController.remove);
router.post('/:wfId/statuses', requireProjectRole(ProjectRole.ADMIN), validate({ params: workflowParams, body: workflowSchemas.status }), auditLogger('workflow.status.create'), workflowsController.createStatus);
router.patch('/:wfId/statuses/:sId', requireProjectRole(ProjectRole.ADMIN), validate({ params: statusParams, body: workflowSchemas.status.partial() }), auditLogger('workflow.status.update'), workflowsController.updateStatus);
router.delete('/:wfId/statuses/:sId', requireProjectRole(ProjectRole.ADMIN), validate({ params: statusParams }), auditLogger('workflow.status.delete'), workflowsController.removeStatus);
router.post('/:wfId/transitions', requireProjectRole(ProjectRole.ADMIN), validate({ params: workflowParams, body: workflowSchemas.transition }), auditLogger('workflow.transition.create'), workflowsController.createTransition);
router.patch('/:wfId/transitions/:tId', requireProjectRole(ProjectRole.ADMIN), validate({ params: transitionParams, body: workflowSchemas.transition.partial() }), auditLogger('workflow.transition.update'), workflowsController.updateTransition);
router.delete('/:wfId/transitions/:tId', requireProjectRole(ProjectRole.ADMIN), validate({ params: transitionParams }), auditLogger('workflow.transition.delete'), workflowsController.removeTransition);
router.post('/:wfId/transitions/:tId/guards', requireProjectRole(ProjectRole.ADMIN), validate({ params: transitionParams, body: workflowSchemas.guard }), auditLogger('workflow.guard.create'), workflowsController.createGuard);
router.delete('/:wfId/transitions/:tId/guards/:gId', requireProjectRole(ProjectRole.ADMIN), validate({ params: guardParams }), auditLogger('workflow.guard.delete'), workflowsController.removeGuard);

export default router;
