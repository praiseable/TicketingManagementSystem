import { prisma } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const issueTypesController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.issueType.findMany({ where: { projectId: req.params.id }, orderBy: { position: 'asc' } }))),
  create: asyncHandler(async (req, res) => created(res, await prisma.issueType.create({ data: { projectId: req.params.id, ...req.body } }))),
  update: asyncHandler(async (req, res) => ok(res, await prisma.issueType.update({ where: { id: req.params.typeId }, data: req.body }))),
  remove: asyncHandler(async (req, res) => { await prisma.issueType.delete({ where: { id: req.params.typeId } }); noContent(res); })
};
