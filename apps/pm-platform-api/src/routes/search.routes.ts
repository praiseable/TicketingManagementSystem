import { Router } from 'express';
import { z } from 'zod';
import { searchController } from '../controllers/search.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, searchSchemas } from '../schemas/index.js';

const router = Router();

// Query parsing is intentionally handled in the controller so saved filters and GUI filter JSON
// can evolve without fragile Zod query coercion breaking the UI.
router.get('/', searchController.global);
router.get('/issues', searchController.issues);
router.post('/filters/save', validate({ body: searchSchemas.saveFilter }), auditLogger('filter.save'), searchController.saveFilter);
router.get('/filters', searchController.filters);
router.delete('/filters/:id', validate({ params: z.object({ id }) }), auditLogger('filter.delete'), searchController.deleteFilter);

export default router;
