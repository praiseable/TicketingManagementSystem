import { prisma } from '@pm-platform/db';
import { asyncHandler, ok, AppError } from '../utils/apiResponse.js';
import { pageService } from '../services/page.service.js';

export const analyticsController = {
  space: asyncHandler(async (req, res) => {
    await pageService.assertSpaceMember(req.params.spaceId, req.user!.id);

    const space = await prisma.space.findFirst({ where: { id: req.params.spaceId, isArchived: false }, select: { id: true, name: true, key: true } });
    if (!space) throw new AppError(404, 'SPACE_NOT_FOUND', 'Space not found');

    const [pages, comments, versions, restrictions, contributors, topPages, lastUpdates] = await Promise.all([
      prisma.page.count({ where: { spaceId: req.params.spaceId, isArchived: false } }),
      prisma.pageComment.count({ where: { page: { spaceId: req.params.spaceId, isArchived: false } } }),
      prisma.pageVersion.count({ where: { page: { spaceId: req.params.spaceId, isArchived: false } } }),
      prisma.pageRestriction.count({ where: { page: { spaceId: req.params.spaceId, isArchived: false } } }),
      prisma.page.groupBy({ by: ['updatedById'], where: { spaceId: req.params.spaceId, isArchived: false }, _count: true }),
      prisma.page.findMany({ where: { spaceId: req.params.spaceId, isArchived: false }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, title: true, version: true, updatedAt: true, _count: { select: { comments: true, versions: true } } } }),
      prisma.auditLog.findMany({ where: { entityType: 'page', action: { in: ['page.create', 'page.update', 'page.restore', 'page.comment.create'] } }, orderBy: { createdAt: 'desc' }, take: 10, select: { action: true, entityId: true, createdAt: true, user: { select: { id: true, name: true, email: true } } } })
    ]);

    ok(res, { space, pages, comments, versions, restrictions, contributors, topPages, lastUpdates });
  })
};
