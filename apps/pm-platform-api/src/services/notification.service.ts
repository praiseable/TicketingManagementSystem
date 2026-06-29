import { prisma, NotificationType } from '@pm-platform/db';
import { emailQueue } from '../queues/index.js';
import { emitToUser } from '../sockets/index.js';

export const notificationService = {
  async notify(userId: string, type: NotificationType, title: string, body: string, entityType: string, entityId: string) {
    const notification = await prisma.notification.create({ data: { userId, type, title, body, entityType, entityId } });
    emitToUser(userId, 'notification:new', notification);
    const pref = await prisma.notificationPref.findUnique({ where: { userId_eventType: { userId, eventType: type } } });
    if (pref?.email ?? true) {
      await emailQueue.add('send-email', { userId, type, title, body, entityType, entityId }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    }
    return notification;
  }
};
