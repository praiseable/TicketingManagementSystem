import { prisma } from '@pm-platform/db';
import { auditService } from '../services/audit.service.js';
import { AppError, asyncHandler, ok } from '../utils/apiResponse.js';
import { hashPassword } from '../utils/hash.js';
import { meta, pagination } from '../utils/paginate.js';

type QueryLike = Record<string, unknown>;

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) value = value[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  const raw = firstString(value);
  if (!raw) return undefined;
  if (['true', '1', 'yes', 'active'].includes(raw.toLowerCase())) return true;
  if (['false', '0', 'no', 'inactive'].includes(raw.toLowerCase())) return false;
  return undefined;
}

function publicUserSelect() {
  return {
    id: true,
    orgId: true,
    email: true,
    name: true,
    avatarUrl: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        projectMemberships: true,
        assignedIssues: true,
        reportedIssues: true,
        worklogs: true,
        notifications: true
      }
    }
  } as const;
}

async function ensureTargetInOrg(orgId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      orgId: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found in this organization');
  return user;
}

async function ensureAnotherActiveAdmin(orgId: string, targetUserId: string) {
  const count = await prisma.user.count({
    where: {
      orgId,
      id: { not: targetUserId },
      isActive: true,
      role: { in: ['ADMIN', 'SUPER_ADMIN'] }
    }
  });
  if (count < 1) throw new AppError(409, 'LAST_ADMIN', 'Cannot remove the last active administrator');
}

async function recordAdminAudit(req: any, action: string, entityId: string, oldData: unknown, newData: unknown) {
  await auditService.record({
    orgId: req.user!.orgId,
    userId: req.user!.id,
    action,
    entityType: 'user',
    entityId,
    oldData,
    newData,
    ipAddress: req.ip,
    userAgent: String(req.headers['user-agent'] ?? '')
  });
}

export const adminController = {
  users: asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = pagination(req.query as QueryLike);
    const q = firstString(req.query.q);
    const role = firstString(req.query.role);
    const isActive = parseBoolean(req.query.isActive);

    const where: any = {
      orgId: req.user!.orgId,
      ...(role ? { role } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {})
    };
    if (q) where.OR = [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }];

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({ where, skip, take, orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }], select: publicUserSelect() }),
      prisma.user.count({ where })
    ]);
    ok(res, data, meta(page, limit, total));
  }),

  activate: asyncHandler(async (req, res) => {
    const oldUser = await ensureTargetInOrg(req.user!.orgId, req.params.id);
    const user = await prisma.user.update({ where: { id: oldUser.id }, data: { isActive: true }, select: publicUserSelect() });
    await recordAdminAudit(req, 'admin.user.activate', oldUser.id, { isActive: oldUser.isActive }, { isActive: true });
    ok(res, user);
  }),

  deactivate: asyncHandler(async (req, res) => {
    const oldUser = await ensureTargetInOrg(req.user!.orgId, req.params.id);
    if (oldUser.id === req.user!.id) throw new AppError(409, 'SELF_DEACTIVATE', 'Administrators cannot deactivate themselves');
    if (oldUser.role === 'ADMIN' || oldUser.role === 'SUPER_ADMIN') await ensureAnotherActiveAdmin(req.user!.orgId, oldUser.id);
    const user = await prisma.user.update({ where: { id: oldUser.id }, data: { isActive: false }, select: publicUserSelect() });
    await prisma.refreshToken.deleteMany({ where: { userId: oldUser.id } });
    await recordAdminAudit(req, 'admin.user.deactivate', oldUser.id, { isActive: oldUser.isActive }, { isActive: false, refreshTokensRevoked: true });
    ok(res, user);
  }),

  role: asyncHandler(async (req, res) => {
    const role = String(req.body.role);
    const oldUser = await ensureTargetInOrg(req.user!.orgId, req.params.id);
    if (role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') throw new AppError(403, 'SUPER_ADMIN_REQUIRED', 'Only a super administrator can assign SUPER_ADMIN');
    if (oldUser.id === req.user!.id && oldUser.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') throw new AppError(409, 'SELF_DEMOTE', 'Super administrators cannot demote themselves');
    if ((oldUser.role === 'ADMIN' || oldUser.role === 'SUPER_ADMIN') && !['ADMIN', 'SUPER_ADMIN'].includes(role)) await ensureAnotherActiveAdmin(req.user!.orgId, oldUser.id);
    const user = await prisma.user.update({ where: { id: oldUser.id }, data: { role: role as any }, select: publicUserSelect() });
    await recordAdminAudit(req, 'admin.user.role', oldUser.id, { role: oldUser.role }, { role });
    ok(res, user);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const oldUser = await ensureTargetInOrg(req.user!.orgId, req.params.id);
    const password = String(req.body.password || `Reset@${Math.random().toString(36).slice(2, 10)}1`);
    if (password.length < 8) throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: oldUser.id }, data: { passwordHash } });
    await prisma.refreshToken.deleteMany({ where: { userId: oldUser.id } });
    await recordAdminAudit(req, 'admin.user.password.reset', oldUser.id, { passwordChanged: false }, { passwordChanged: true, refreshTokensRevoked: true });
    ok(res, { userId: oldUser.id, email: oldUser.email, temporaryPassword: password, refreshTokensRevoked: true });
  }),

  audit: asyncHandler(async (req, res) => {
    const result = await auditService.list(req.user!.orgId, req.query as QueryLike);
    ok(res, result.data, result.meta);
  }),

  stats: asyncHandler(async (req, res) => {
    const [totalUsers, activeUsers, totalProjects, totalIssues, totalAuditLogs, unreadNotifications, storage] = await Promise.all([
      prisma.user.count({ where: { orgId: req.user!.orgId } }),
      prisma.user.count({ where: { orgId: req.user!.orgId, isActive: true } }),
      prisma.project.count({ where: { orgId: req.user!.orgId } }),
      prisma.issue.count({ where: { project: { orgId: req.user!.orgId } } }),
      prisma.auditLog.count({ where: { orgId: req.user!.orgId } }),
      prisma.notification.count({ where: { user: { orgId: req.user!.orgId }, isRead: false } }),
      prisma.attachment.aggregate({ where: { user: { orgId: req.user!.orgId } }, _sum: { sizeBytes: true } })
    ]);
    ok(res, { totalUsers, activeUsers, inactiveUsers: totalUsers - activeUsers, totalProjects, totalIssues, totalAuditLogs, unreadNotifications, storageUsed: Number(storage._sum.sizeBytes ?? 0) });
  })
};
