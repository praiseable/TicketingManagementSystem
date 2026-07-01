import { Worker } from 'bullmq';
import { prisma } from '@pm-platform/db';
import { connection } from '../index.js';
import { emailService } from '../../services/email.service.js';

export const emailWorker = new Worker(
  'email-queue',
  async (job) => {
    const result = await emailService.sendNotification(job.data.userId, job.data.title, job.data.body, job.data.html);
    const user = await prisma.user.findUnique({ where: { id: job.data.userId }, select: { id: true, orgId: true } });
    if (user) {
      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          userId: user.id,
          action: 'email.notification.sent',
          entityType: String(job.data.entityType ?? (job.data.notificationId ? 'notification' : 'email')),
          entityId: String(job.data.entityId ?? job.data.notificationId ?? job.id),
          oldData: null,
          newData: {
            queue: 'email-queue',
            jobId: String(job.id),
            notificationId: job.data.notificationId ?? null,
            entityType: job.data.entityType ?? null,
            entityId: job.data.entityId ?? null,
            type: job.data.type ?? null,
            title: job.data.title ?? null,
            skipped: result?.skipped ?? false,
            accepted: result?.accepted ?? [],
            rejected: result?.rejected ?? [],
            messageId: result?.messageId ?? null
          },
          ipAddress: null,
          userAgent: 'email-worker'
        }
      }).catch((error) => {
        console.error('[email-worker] failed to write audit log', error);
      });
    }
    return result;
  },
  { connection, concurrency: 5 }
);
