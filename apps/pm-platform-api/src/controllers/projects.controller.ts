import crypto from 'node:crypto';
import { prisma, ProjectRole } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

export const projectsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.project.findMany({ where: { orgId: req.user!.orgId, members: { some: { userId: req.user!.id } } }, include: { lead: { select: { id: true, name: true, email: true, avatarUrl: true } }, _count: { select: { issues: true, members: true } } }, orderBy: { updatedAt: 'desc' } }))),
  create: asyncHandler(async (req, res) => {
    const project = await prisma.project.create({ data: { orgId: req.user!.orgId, leadId: req.user!.id, name: req.body.name, key: req.body.key, description: req.body.description, iconUrl: req.body.iconUrl, members: { create: { userId: req.user!.id, role: ProjectRole.OWNER } } } });
    created(res, project);
  }),
  get: asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { lead: { select: { id: true, name: true, email: true } }, workflows: { include: { statuses: { orderBy: { position: 'asc' } }, transitions: true } } } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    ok(res, project);
  }),
  update: asyncHandler(async (req, res) => ok(res, await prisma.project.update({ where: { id: req.params.id }, data: req.body }))),
  remove: asyncHandler(async (req, res) => { await prisma.project.update({ where: { id: req.params.id }, data: { isArchived: true } }); noContent(res); }),
  invite: asyncHandler(async (req, res) => created(res, await prisma.invitation.create({ data: { orgId: req.user!.orgId, projectId: req.params.id, email: req.body.email, role: req.body.role, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 7 * 86400_000), invitedById: req.user!.id } }))),
  members: asyncHandler(async (req, res) => ok(res, await prisma.projectMember.findMany({ where: { projectId: req.params.id }, include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } } } }))),
  updateMember: asyncHandler(async (req, res) => ok(res, await prisma.projectMember.update({ where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } }, data: { role: req.body.role } }))),
  removeMember: asyncHandler(async (req, res) => { await prisma.projectMember.delete({ where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } } }); noContent(res); })
};
