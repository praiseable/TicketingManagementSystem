import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { issueTypesController } from '../controllers/issueTypes.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { id, typeSchemas } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ id }).passthrough();
const typeParams = z.object({ id, typeId: id }).passthrough();

router.get('/', requireProjectRole(ProjectRole.VIEWER), validate({ params: projectParams }), issueTypesController.list);
router.post('/', requireProjectRole(ProjectRole.ADMIN), validate({ params: projectParams, body: typeSchemas.issueType }), auditLogger('issueType.create'), issueTypesController.create);
router.patch('/:typeId', requireProjectRole(ProjectRole.ADMIN), validate({ params: typeParams, body: typeSchemas.issueType.partial() }), auditLogger('issueType.update'), issueTypesController.update);
router.delete('/:typeId', requireProjectRole(ProjectRole.ADMIN), validate({ params: typeParams }), auditLogger('issueType.delete'), issueTypesController.remove);

export default router;
