import { prisma } from '@pm-platform/db';
import { auditService } from '../services/audit.service.js';
import { asyncHandler, ok } from '../utils/apiResponse.js';
import { pagination, meta } from '../utils/paginate.js';

export const adminController = {
  users: asyncHandler(async (req, res) => { const { page, limit, skip, take } = pagination(req.query); const [data, total] = await prisma.$transaction([prisma.user.findMany({ skip, take, orderBy: { createdAt: 'desc' } }), prisma.user.count()]); ok(res, data, meta(page, limit, total)); }),
  activate: asyncHandler(async (req, res) => ok(res, await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } }))),
  deactivate: asyncHandler(async (req, res) => ok(res, await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }))),
  role: asyncHandler(async (req, res) => ok(res, await prisma.user.update({ where: { id: req.params.id }, data: { role: req.body.role } }))),
  audit: asyncHandler(async (req, res) => { const result = await auditService.list(req.user!.orgId, req.query); ok(res, result.data, result.meta); }),
  stats: asyncHandler(async (_req, res) => { const [totalUsers, activeUsers, totalProjects, totalIssues] = await Promise.all([prisma.user.count(), prisma.user.count({ where: { isActive: true } }), prisma.project.count(), prisma.issue.count()]); ok(res, { totalUsers, activeUsers, totalProjects, totalIssues, storageUsed: 0 }); })
};
