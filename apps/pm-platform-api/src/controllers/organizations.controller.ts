import { prisma } from '@pm-platform/db';
import { asyncHandler, noContent, ok, AppError } from '../utils/apiResponse.js';

function asString(value: unknown): string | undefined {
  if (Array.isArray(value)) return asString(value[0]);
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v || undefined;
}

export const organizationsController = {
  get: asyncHandler(async (req, res) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
      include: {
        _count: { select: { users: true, projects: true, spaces: true } }
      }
    });
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
    ok(res, org);
  }),

  update: asyncHandler(async (req, res) => {
    const body = req.body as { name?: string; logoUrl?: string | null; settings?: Record<string, unknown> };
    const org = await prisma.organization.update({
      where: { id: req.user!.orgId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.settings !== undefined ? { settings: body.settings } : {})
      },
      include: { _count: { select: { users: true, projects: true, spaces: true } } }
    });
    ok(res, org);
  }),

  members: asyncHandler(async (req, res) => {
    const members = await prisma.user.findMany({
      where: { orgId: req.user!.orgId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { projectMemberships: true } }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
    ok(res, members);
  }),

  removeMember: asyncHandler(async (req, res) => {
    const userId = asString((req.params as any).userId);
    if (!userId) throw new AppError(400, 'USER_ID_REQUIRED', 'User id is required');
    if (userId === req.user!.id) throw new AppError(409, 'CANNOT_REMOVE_SELF', 'You cannot deactivate your own account');

    const user = await prisma.user.findFirst({ where: { id: userId, orgId: req.user!.orgId } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found in this organization');

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });
    noContent(res);
  })
};
