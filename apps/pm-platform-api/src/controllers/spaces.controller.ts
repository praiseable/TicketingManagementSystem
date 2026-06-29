import { prisma, SpaceRole } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

export const spacesController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.space.findMany({ where: { orgId: req.user!.orgId, members: { some: { userId: req.user!.id } } }, include: { _count: { select: { pages: true } } } }))),
  create: asyncHandler(async (req, res) => { const space = await prisma.space.create({ data: { orgId: req.user!.orgId, ownerId: req.user!.id, ...req.body, members: { create: { userId: req.user!.id, role: SpaceRole.OWNER } } } }); created(res, space); }),
  get: asyncHandler(async (req, res) => { const space = await prisma.space.findUnique({ where: { id: req.params.spaceId }, include: { members: true } }); if (!space) throw new AppError(404, 'SPACE_NOT_FOUND', 'Space not found'); ok(res, space); }),
  update: asyncHandler(async (req, res) => ok(res, await prisma.space.update({ where: { id: req.params.spaceId }, data: req.body }))),
  remove: asyncHandler(async (req, res) => { await prisma.space.update({ where: { id: req.params.spaceId }, data: { isArchived: true } }); noContent(res); })
};
