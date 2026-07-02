import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@pm-platform/db';
import { permissionSchemesController } from '../controllers/permissionSchemes.controller.js';
import { requireProjectRole } from '../middleware/requireProjectRole.js';
import { validate } from '../middleware/validate.js';
import { id } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const projectParams = z.object({ projectId: id }).passthrough();
const schemeParams = z.object({ projectId: id, schemeId: z.string().min(6) }).passthrough();
const schemeBody = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), rules: z.record(z.unknown()).optional() }).passthrough();

router.get('/', requireProjectRole(ProjectRole.VIEWER), validate({ params: projectParams }), permissionSchemesController.list);
router.post('/', requireProjectRole(ProjectRole.ADMIN), validate({ params: projectParams, body: schemeBody }), permissionSchemesController.create);
router.patch('/:schemeId', requireProjectRole(ProjectRole.ADMIN), validate({ params: schemeParams, body: schemeBody }), permissionSchemesController.update);
router.post('/:schemeId/apply', requireProjectRole(ProjectRole.ADMIN), validate({ params: schemeParams }), permissionSchemesController.apply);
router.delete('/:schemeId', requireProjectRole(ProjectRole.ADMIN), validate({ params: schemeParams }), permissionSchemesController.remove);

export default router;
