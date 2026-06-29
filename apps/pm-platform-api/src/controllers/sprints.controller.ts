import { prisma } from '@pm-platform/db';
import { sprintService } from '../services/sprint.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const sprintsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.sprint.findMany({ where: { projectId: req.params.projectId }, orderBy: { startDate: 'desc' } }))),
  create: asyncHandler(async (req, res) => created(res, await sprintService.create(req.params.projectId, req.body))),
  get: asyncHandler(async (req, res) => ok(res, await prisma.sprint.findUnique({ where: { id: req.params.sprintId }, include: { issues: { include: { issueType: true, workflowStatus: true, assignee: { select: { id: true, name: true, email: true } } } } } }))),
  update: asyncHandler(async (req, res) => ok(res, await prisma.sprint.update({ where: { id: req.params.sprintId }, data: { ...req.body, startDate: req.body.startDate ? new Date(req.body.startDate) : undefined, endDate: req.body.endDate ? new Date(req.body.endDate) : undefined } }))),
  start: asyncHandler(async (req, res) => ok(res, await sprintService.start(req.params.projectId, req.params.sprintId))),
  complete: asyncHandler(async (req, res) => ok(res, await sprintService.complete(req.params.projectId, req.params.sprintId, req.body.moveToSprintId))),
  remove: asyncHandler(async (req, res) => { await prisma.sprint.delete({ where: { id: req.params.sprintId } }); noContent(res); }),
  burndown: asyncHandler(async (req, res) => ok(res, await sprintService.burndown(req.params.sprintId))),
  velocity: asyncHandler(async (req, res) => ok(res, await sprintService.velocity(req.params.projectId)))
};
