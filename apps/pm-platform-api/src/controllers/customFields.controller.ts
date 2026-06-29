import { prisma } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const customFieldsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.customField.findMany({ where: { projectId: req.params.id }, orderBy: { position: 'asc' } }))),
  create: asyncHandler(async (req, res) => created(res, await prisma.customField.create({ data: { projectId: req.params.id, ...req.body } }))),
  update: asyncHandler(async (req, res) => ok(res, await prisma.customField.update({ where: { id: req.params.fId }, data: req.body }))),
  remove: asyncHandler(async (req, res) => { await prisma.customField.delete({ where: { id: req.params.fId } }); noContent(res); })
};
