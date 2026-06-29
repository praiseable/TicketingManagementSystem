import { prisma } from '@pm-platform/db';
import { asyncHandler, noContent, ok } from '../utils/apiResponse.js';

export const organizationsController = {
  get: asyncHandler(async (req, res) => ok(res, await prisma.organization.findUnique({ where: { id: req.user!.orgId } }))),
  update: asyncHandler(async (req, res) => ok(res, await prisma.organization.update({ where: { id: req.user!.orgId }, data: req.body }))),
  members: asyncHandler(async (req, res) => ok(res, await prisma.user.findMany({ where: { orgId: req.user!.orgId }, select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true } }))),
  removeMember: asyncHandler(async (req, res) => { await prisma.user.update({ where: { id: req.params.userId }, data: { isActive: false } }); noContent(res); })
};
