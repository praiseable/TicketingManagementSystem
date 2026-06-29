import { prisma } from '@pm-platform/db';
import { worklogService } from '../services/worklog.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const worklogsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.worklog.findMany({ where: { issueId: req.params.issueId }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, orderBy: { dateStarted: 'desc' } }))),
  create: asyncHandler(async (req, res) => created(res, await worklogService.create(req.params.issueId, req.user!.id, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await worklogService.update(req.params.worklogId, req.user!.id, req.user!.role !== 'MEMBER', req.body))),
  remove: asyncHandler(async (req, res) => { await worklogService.delete(req.params.worklogId, req.user!.id, req.user!.role !== 'MEMBER'); noContent(res); })
};
