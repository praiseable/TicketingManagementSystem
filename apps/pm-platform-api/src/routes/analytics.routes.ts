import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
const router = Router({ mergeParams: true });
router.get('/', analyticsController.space);
export default router;
