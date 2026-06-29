import { prisma } from '@pm-platform/db';
import { asyncHandler, noContent, ok } from '../utils/apiResponse.js';
import { MAX_LIMIT } from '../config/constants.js';

function toPositiveInt(value: unknown, fallback: number): number {
  if (Array.isArray(value)) value = value[0];
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toBool(value: unknown): boolean {
  if (Array.isArray(value)) value = value[0];
  return value === true || value === 'true' || value === '1' || value === 1;
}

function getParam(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

export const notificationsController = {
  list: asyncHandler(async (req, res) => {
    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, 25), MAX_LIMIT || 500);
    const skip = (page - 1) * limit;
    const where = {
      userId: req.user!.id,
      ...(toBool(req.query.unreadOnly) ? { isRead: false } : {})
    };

    const [data, total] = await prisma.$transaction([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where })
    ]);

    ok(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }),

  read: asyncHandler(async (req, res) => {
    const id = getParam(req.params.id);
    await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { isRead: true } });
    noContent(res);
  }),

  readAll: asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    noContent(res);
  }),

  prefs: asyncHandler(async (req, res) => {
    const prefs = await prisma.notificationPref.findMany({ where: { userId: req.user!.id } });
    ok(res, prefs);
  }),

  updatePrefs: asyncHandler(async (req, res) => {
    const data = [];
    for (const pref of req.body.prefs ?? []) {
      data.push(await prisma.notificationPref.upsert({
        where: { userId_eventType: { userId: req.user!.id, eventType: pref.eventType } },
        update: { inApp: pref.inApp, email: pref.email },
        create: { userId: req.user!.id, eventType: pref.eventType, inApp: pref.inApp, email: pref.email }
      }));
    }
    ok(res, data);
  })
};
