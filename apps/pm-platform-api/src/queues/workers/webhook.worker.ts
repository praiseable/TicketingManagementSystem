import { Worker } from 'bullmq';
import { prisma } from '@pm-platform/db';
import { connection } from '../index.js';
import { webhookService } from '../../services/webhook.service.js';

export const webhookWorker = new Worker(
  'webhook-queue',
  async (job) => {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { webhookConfig: true }
    });
    if (!delivery) return { skipped: true };

    const body = JSON.stringify(delivery.payload ?? {});
    try {
      const response = await fetch(delivery.webhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PM-Event': delivery.event,
          'X-PM-Delivery': delivery.id,
          ...(delivery.webhookConfig.secret ? { 'X-PM-Signature': webhookService.sign(delivery.webhookConfig.secret, body)! } : {})
        },
        body
      });
      const text = await response.text();
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: response.status,
          response: text.slice(0, 5000),
          deliveredAt: response.ok ? new Date() : null,
          attempt: { increment: 1 }
        }
      });
      if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
      return { ok: true, status: response.status };
    } catch (error: any) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          response: String(error?.message ?? error).slice(0, 5000),
          attempt: { increment: 1 }
        }
      }).catch(() => undefined);
      throw error;
    }
  },
  { connection, concurrency: 10 }
);
