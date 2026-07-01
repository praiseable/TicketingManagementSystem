import { prisma, NotificationType } from '@pm-platform/db';
import { emailQueue } from '../queues/index.js';
import { emitToUser } from '../sockets/index.js';

async function ensurePref(userId: string, type: NotificationType) {
  return prisma.notificationPref.upsert({
    where: { userId_eventType: { userId, eventType: type } },
    update: {},
    create: { userId, eventType: type, inApp: true, email: true }
  });
}

export const notificationService = {
  async notify(userId: string, type: NotificationType, title: string, body: string, entityType: string, entityId: string) {
    const pref = await ensurePref(userId, type);
    let notification = null as any;

    if (pref.inApp) {
      notification = await prisma.notification.create({ data: { userId, type, title, body, entityType, entityId } });
      emitToUser(userId, 'notification:new', notification);
    }

    if (pref.email) {
      await emailQueue.add(
        'send-email',
        { userId, type, title, body, entityType, entityId, notificationId: notification?.id ?? null },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      );
    }

    return notification ?? { queuedEmailOnly: pref.email, userId, type, title, body, entityType, entityId };
  }
};
