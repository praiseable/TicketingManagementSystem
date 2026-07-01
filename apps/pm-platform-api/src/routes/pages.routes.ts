import { Router } from 'express';
import { z } from 'zod';
import { pagesController } from '../controllers/pages.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, pageSchemas } from '../schemas/index.js';

const router = Router({ mergeParams: true });
const pageParams = z.object({ spaceId: id, pageId: id });

router.get('/', validate({ params: z.object({ spaceId: id }) }), pagesController.tree);
router.post('/', validate({ params: z.object({ spaceId: id }), body: pageSchemas.create }), auditLogger('page.create'), pagesController.create);
router.get('/:pageId', validate({ params: pageParams }), pagesController.get);
router.patch('/:pageId', validate({ params: pageParams, body: pageSchemas.update }), auditLogger('page.update'), pagesController.update);
router.delete('/:pageId', validate({ params: pageParams }), auditLogger('page.delete'), pagesController.remove);
router.get('/:pageId/versions', validate({ params: pageParams }), pagesController.versions);
router.post('/:pageId/restore/:v', validate({ params: z.object({ spaceId: id, pageId: id, v: z.string() }) }), auditLogger('page.restore'), pagesController.restore);
router.get('/:pageId/collab/state', validate({ params: pageParams }), pagesController.collabState);
router.post('/:pageId/collab/presence', validate({ params: pageParams }), pagesController.collabPresence);
router.post('/:pageId/export/pdf', validate({ params: pageParams }), pagesController.exportPdf);
router.post('/:pageId/export/docx', validate({ params: pageParams }), pagesController.exportDocx);
router.post('/:pageId/share', validate({ params: pageParams }), auditLogger('page.share'), pagesController.share);

export default router;
