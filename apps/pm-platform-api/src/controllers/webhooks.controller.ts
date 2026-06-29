import { prisma } from '@pm-platform/db';
import { webhookService } from '../services/webhook.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const webhooksController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.webhookConfig.findMany({ where: { projectId: req.params.projectId } }))),
  create: asyncHandler(async (req, res) => created(res, await prisma.webhookConfig.create({ data: { projectId: req.params.projectId, ...req.body } }))),
  update: asyncHandler(async (req, res) => ok(res, await prisma.webhookConfig.update({ where: { id: req.params.id }, data: req.body }))),
  remove: asyncHandler(async (req, res) => { await prisma.webhookConfig.delete({ where: { id: req.params.id } }); noContent(res); }),
  deliveries: asyncHandler(async (req, res) => ok(res, await prisma.webhookDelivery.findMany({ where: { webhookConfigId: req.params.id }, orderBy: { createdAt: 'desc' } }))),
  test: asyncHandler(async (req, res) => { await webhookService.queueProjectEvent(req.params.projectId, 'webhook.test', { projectId: req.params.projectId, at: new Date().toISOString() }); noContent(res); })
};
