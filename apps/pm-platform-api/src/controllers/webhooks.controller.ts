import { prisma } from '@pm-platform/db';
import { webhookService } from '../services/webhook.service.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

function str(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

async function assertWebhook(projectId: string, id: string) {
  const hook = await prisma.webhookConfig.findFirst({ where: { id, projectId } });
  if (!hook) throw new AppError(404, 'WEBHOOK_NOT_FOUND', 'Webhook not found');
  return hook;
}

export const webhooksController = {
  list: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    ok(res, await prisma.webhookConfig.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }));
  }),

  create: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    const hook = await prisma.webhookConfig.create({
      data: {
        projectId,
        url: req.body.url,
        events: req.body.events ?? [],
        secret: req.body.secret ?? webhookService.generateSecret(),
        isActive: req.body.isActive ?? true
      }
    });
    created(res, hook);
  }),

  update: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    const id = str(req.params.id);
    await assertWebhook(projectId, id);
    const data: any = {};
    for (const key of ['url', 'events', 'secret', 'isActive']) if (key in req.body) data[key] = req.body[key];
    ok(res, await prisma.webhookConfig.update({ where: { id }, data }));
  }),

  remove: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    const id = str(req.params.id);
    await assertWebhook(projectId, id);
    await prisma.webhookConfig.delete({ where: { id } });
    noContent(res);
  }),

  deliveries: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    const id = str(req.params.id);
    await assertWebhook(projectId, id);
    ok(res, await prisma.webhookDelivery.findMany({ where: { webhookConfigId: id }, orderBy: { createdAt: 'desc' } }));
  }),

  test: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    const id = str(req.params.id);
    const hook = await assertWebhook(projectId, id);
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookConfigId: hook.id,
        event: 'webhook.test',
        payload: {
          event: 'webhook.test',
          projectId,
          webhookId: hook.id,
          triggeredById: req.user!.id,
          at: new Date().toISOString()
        }
      }
    });
    await webhookService.queueProjectEvent(projectId, 'webhook.test', { projectId, webhookId: hook.id, triggeredById: req.user!.id, at: new Date().toISOString() });
    ok(res, { queued: true, deliveryId: delivery.id });
  })
};
