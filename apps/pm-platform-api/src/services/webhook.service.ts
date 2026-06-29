import crypto from 'node:crypto';
import { prisma } from '@pm-platform/db';
import { webhookQueue } from '../queues/index.js';

export const webhookService = {
  async queueProjectEvent(projectId: string, event: string, payload: unknown) {
    const hooks = await prisma.webhookConfig.findMany({ where: { projectId, isActive: true, events: { has: event } } });
    for (const hook of hooks) {
      const delivery = await prisma.webhookDelivery.create({ data: { webhookConfigId: hook.id, event, payload: payload as object } });
      await webhookQueue.add('deliver-webhook', { deliveryId: delivery.id }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    }
  },

  sign(secret: string | null, body: string) {
    if (!secret) return undefined;
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
};
