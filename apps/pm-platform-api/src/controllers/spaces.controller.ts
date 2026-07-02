import { prisma, SpaceRole } from '@pm-platform/db';
import { pageService } from '../services/page.service.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

async function requireSpaceOwner(spaceId: string, userId: string) {
  const member = await prisma.spaceMember.findFirst({ where: { spaceId, userId } });
  if (!member) throw new AppError(403, 'SPACE_FORBIDDEN', 'You are not a member of this space');
  if (member.role !== SpaceRole.OWNER) throw new AppError(403, 'SPACE_FORBIDDEN', 'Only space owners can manage this space');
  return member;
}

export const spacesController = {
  templates: asyncHandler(async (_req, res) => ok(res, pageService.templates())),

  list: asyncHandler(async (req, res) => {
    const spaces = await prisma.space.findMany({
      where: { orgId: req.user!.orgId, isArchived: false, members: { some: { userId: req.user!.id } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { pages: true } }
      }
    });

    ok(res, spaces);
  }),

  create: asyncHandler(async (req, res) => {
    const key = String(req.body.key).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);

    const space = await prisma.space.create({
      data: {
        orgId: req.user!.orgId,
        ownerId: req.user!.id,
        type: req.body.type,
        name: req.body.name,
        key,
        description: req.body.description ?? null,
        iconUrl: req.body.iconUrl ?? null,
        members: { create: { userId: req.user!.id, role: SpaceRole.OWNER } }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { pages: true } }
      }
    });

    await prisma.auditLog.create({
      data: { orgId: req.user!.orgId, userId: req.user!.id, action: 'space.create', entityType: 'space', entityId: space.id, newData: { name: space.name, key: space.key, type: space.type }, ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null }
    });

    created(res, space);
  }),

  get: asyncHandler(async (req, res) => {
    const space = await prisma.space.findFirst({
      where: { id: req.params.spaceId, orgId: req.user!.orgId, isArchived: false, members: { some: { userId: req.user!.id } } },
      include: { owner: { select: { id: true, name: true, email: true } }, members: { include: { user: { select: { id: true, name: true, email: true } } } }, _count: { select: { pages: true } } }
    });

    if (!space) throw new AppError(404, 'SPACE_NOT_FOUND', 'Space not found');
    ok(res, space);
  }),

  update: asyncHandler(async (req, res) => {
    await requireSpaceOwner(req.params.spaceId, req.user!.id);
    ok(res, await prisma.space.update({ where: { id: req.params.spaceId }, data: { name: req.body.name, description: req.body.description, iconUrl: req.body.iconUrl, isArchived: req.body.isArchived } }));
  }),

  remove: asyncHandler(async (req, res) => { await requireSpaceOwner(req.params.spaceId, req.user!.id); await prisma.space.update({ where: { id: req.params.spaceId }, data: { isArchived: true } }); noContent(res); }),

  members: asyncHandler(async (req, res) => {
    const space = await prisma.space.findFirst({ where: { id: req.params.spaceId, members: { some: { userId: req.user!.id } } } });
    if (!space) throw new AppError(404, 'SPACE_NOT_FOUND', 'Space not found');

    ok(res, await prisma.spaceMember.findMany({ where: { spaceId: req.params.spaceId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } }));
  }),

  addMember: asyncHandler(async (req, res) => {
    await requireSpaceOwner(req.params.spaceId, req.user!.id);
    const user = await prisma.user.findFirst({ where: { orgId: req.user!.orgId, email: String(req.body.email).toLowerCase(), isActive: true } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found in organization');

    const role = (req.body.role ?? SpaceRole.VIEWER) as SpaceRole;
    const member = await prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId: req.params.spaceId, userId: user.id } },
      create: { spaceId: req.params.spaceId, userId: user.id, role },
      update: { role },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    created(res, member);
  }),

  updateMember: asyncHandler(async (req, res) => {
    await requireSpaceOwner(req.params.spaceId, req.user!.id);
    ok(res, await prisma.spaceMember.update({ where: { id: req.params.memberId }, data: { role: req.body.role as SpaceRole }, include: { user: { select: { id: true, name: true, email: true } } } }));
  }),

  removeMember: asyncHandler(async (req, res) => {
    await requireSpaceOwner(req.params.spaceId, req.user!.id);
    const member = await prisma.spaceMember.findUnique({ where: { id: req.params.memberId } });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found');
    if (member.userId === req.user!.id) throw new AppError(409, 'CANNOT_REMOVE_SELF', 'Space owner cannot remove themselves');
    await prisma.spaceMember.delete({ where: { id: req.params.memberId } });
    noContent(res);
  })
};
