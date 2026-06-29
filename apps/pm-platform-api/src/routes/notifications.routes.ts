import { Router } from 'express';
import { prisma } from '@pm-platform/db';
import { notificationsController } from '../controllers/notifications.controller.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { validate } from '../middleware/validate.js';
import { notificationSchemas } from '../schemas/index.js';
import { asyncHandler, noContent } from '../utils/apiResponse.js';

const router = Router();

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function routeParam(value: unknown): string {
  const raw = first(value);
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}

// Keep list validation-free; the topbar notification bell must not break the workspace.
router.get('/', notificationsController.list);

router.get('/preferences', notificationsController.prefs);
router.patch(
  '/preferences',
  validate({ body: notificationSchemas.prefs }),
  auditLogger('notification.preferences'),
  notificationsController.updatePrefs
);

// Read operations do not require request bodies. They are scoped to req.user.
router.patch('/read-all', auditLogger('notification.readAll'), asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true }
  });
  noContent(res);
}));

router.patch('/:id/read', auditLogger('notification.read'), asyncHandler(async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return noContent(res);

  await prisma.$executeRaw`
    UPDATE "Notification"
    SET "isRead" = true
    WHERE "id"::text = ${id}
      AND "userId"::text = ${req.user!.id}
  `;

  noContent(res);
}));

export default router;
