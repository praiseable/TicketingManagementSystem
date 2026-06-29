import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { customFieldsController } from '../controllers/customFields.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { id, typeSchemas } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ id }).passthrough();
const fieldParams = z.object({ id, fId: id }).passthrough();

router.get('/', requireProjectRole(ProjectRole.VIEWER), validate({ params: projectParams }), customFieldsController.list);
router.post('/', requireProjectRole(ProjectRole.ADMIN), validate({ params: projectParams, body: typeSchemas.customField }), auditLogger('customField.create'), customFieldsController.create);
router.patch('/:fId', requireProjectRole(ProjectRole.ADMIN), validate({ params: fieldParams, body: typeSchemas.customField.partial() }), auditLogger('customField.update'), customFieldsController.update);
router.delete('/:fId', requireProjectRole(ProjectRole.ADMIN), validate({ params: fieldParams }), auditLogger('customField.delete'), customFieldsController.remove);

export default router;
