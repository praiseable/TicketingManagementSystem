import { Worker } from 'bullmq';
import { prisma } from '@pm-platform/db';
import { connection } from '../index.js';
import { webhookService } from '../../services/webhook.service.js';

export const webhookWorker = new Worker(
  'webhook-queue',
  async (job) => {
    const delivery = await prisma.webhookDelivery.findUnique({ where: { id: job.data.deliveryId }, include: { webhookConfig: true } });
    if (!delivery) return;
    const body = JSON.stringify(delivery.payload);
    const response = await fetch(delivery.webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PM-Event': delivery.event,
        ...(delivery.webhookConfig.secret ? { 'X-PM-Signature': webhookService.sign(delivery.webhookConfig.secret, body)! } : {})
      },
      body
    });
    await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { statusCode: response.status, response: await response.text(), deliveredAt: response.ok ? new Date() : null, attempt: { increment: 1 } } });
    if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
  },
  { connection, concurrency: 10 }
);
