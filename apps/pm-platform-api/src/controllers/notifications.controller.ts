import { NotificationType, prisma } from '@pm-platform/db';
import { asyncHandler, noContent, ok } from '../utils/apiResponse.js';
import { MAX_LIMIT } from '../config/constants.js';

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const raw = first(value);
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toBool(value: unknown): boolean {
  const raw = first(value);
  return raw === true || raw === 'true' || raw === '1' || raw === 1 || raw === 'yes';
}

function toParam(value: unknown): string {
  const raw = first(value);
  return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
}

const defaultPrefTypes = Object.values(NotificationType);

async function ensureDefaultPrefs(userId: string) {
  for (const eventType of defaultPrefTypes) {
    await prisma.notificationPref.upsert({
      where: { userId_eventType: { userId, eventType } },
      update: {},
      create: { userId, eventType, inApp: true, email: true }
    });
  }
}

export const notificationsController = {
  list: asyncHandler(async (req, res) => {
    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, 25), MAX_LIMIT || 500);
    const skip = (page - 1) * limit;
    const unreadOnly = toBool(req.query.unreadOnly);

    const where = {
      userId: req.user!.id,
      ...(unreadOnly ? { isRead: false } : {})
    };

    const [data, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } })
    ]);

    ok(res, data, { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount } as any);
  }),

  read: asyncHandler(async (req, res) => {
    const id = toParam(req.params.id);
    await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { isRead: true } });
    noContent(res);
  }),

  readAll: asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    noContent(res);
  }),

  prefs: asyncHandler(async (req, res) => {
    await ensureDefaultPrefs(req.user!.id);
    const prefs = await prisma.notificationPref.findMany({ where: { userId: req.user!.id }, orderBy: { eventType: 'asc' } });
    ok(res, prefs);
  }),

  updatePrefs: asyncHandler(async (req, res) => {
    const result = [];
    for (const pref of req.body.prefs ?? []) {
      if (!pref?.eventType) continue;
      result.push(await prisma.notificationPref.upsert({
        where: { userId_eventType: { userId: req.user!.id, eventType: pref.eventType } },
        update: { inApp: Boolean(pref.inApp), email: Boolean(pref.email) },
        create: { userId: req.user!.id, eventType: pref.eventType, inApp: Boolean(pref.inApp), email: Boolean(pref.email) }
      }));
    }
    ok(res, result);
  })
};
