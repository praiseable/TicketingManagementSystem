import { Router } from 'express';
import { performanceController } from '../controllers/performance.controller.js';

const router = Router();

router.get('/me', performanceController.me);
router.get('/team', performanceController.team);
router.get('/reports/time', performanceController.timeReport);
router.get('/reports/time/export', performanceController.exportTime);

export default router;
