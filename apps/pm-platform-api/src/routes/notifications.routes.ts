import { Router } from 'express';
import { z } from 'zod';
import { notificationsController } from '../controllers/notifications.controller.js';
import { validate } from '../middleware/validate.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { id, notificationSchemas } from '../schemas/index.js';

const router = Router();

// Important: keep the list route validation-free and parse query safely inside
// the controller. This route is used globally by the topbar notification bell;
// a validation failure here should never blank or degrade the main workspace.
router.get('/', notificationsController.list);

// Put fixed paths before parameterized paths.
router.get('/preferences', notificationsController.prefs);
router.patch('/preferences', validate({ body: notificationSchemas.prefs }), auditLogger('notification.preferences'), notificationsController.updatePrefs);
router.patch('/read-all', auditLogger('notification.readAll'), notificationsController.readAll);
router.patch('/:id/read', validate({ params: z.object({ id }) }), auditLogger('notification.read'), notificationsController.read);

export default router;
