import { prisma } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const workflowsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.workflow.findMany({ where: { projectId: req.params.projectId }, include: { statuses: { orderBy: { position: 'asc' } }, transitions: true } }))),
  create: asyncHandler(async (req, res) => created(res, await prisma.workflow.create({ data: { projectId: req.params.projectId, ...req.body } }))),
  get: asyncHandler(async (req, res) => ok(res, await prisma.workflow.findUnique({ where: { id: req.params.wfId }, include: { statuses: { orderBy: { position: 'asc' } }, transitions: { include: { guards: true, postFns: true } } } }))),
  update: asyncHandler(async (req, res) => ok(res, await prisma.workflow.update({ where: { id: req.params.wfId }, data: req.body }))),
  remove: asyncHandler(async (req, res) => { await prisma.workflow.delete({ where: { id: req.params.wfId } }); noContent(res); }),
  createStatus: asyncHandler(async (req, res) => created(res, await prisma.workflowStatus.create({ data: { workflowId: req.params.wfId, ...req.body } }))),
  updateStatus: asyncHandler(async (req, res) => ok(res, await prisma.workflowStatus.update({ where: { id: req.params.sId }, data: req.body }))),
  removeStatus: asyncHandler(async (req, res) => { await prisma.workflowStatus.delete({ where: { id: req.params.sId } }); noContent(res); }),
  createTransition: asyncHandler(async (req, res) => created(res, await prisma.workflowTransition.create({ data: { workflowId: req.params.wfId, ...req.body } }))),
  updateTransition: asyncHandler(async (req, res) => ok(res, await prisma.workflowTransition.update({ where: { id: req.params.tId }, data: req.body }))),
  removeTransition: asyncHandler(async (req, res) => { await prisma.workflowTransition.delete({ where: { id: req.params.tId } }); noContent(res); }),
  createGuard: asyncHandler(async (req, res) => created(res, await prisma.transitionGuard.create({ data: { transitionId: req.params.tId, ...req.body } }))),
  removeGuard: asyncHandler(async (req, res) => { await prisma.transitionGuard.delete({ where: { id: req.params.gId } }); noContent(res); })
};
