import { prisma } from '@pm-platform/db';
import { asyncHandler, ok } from '../utils/apiResponse.js';

export const analyticsController = {
  space: asyncHandler(async (req, res) => { const pages = await prisma.page.count({ where: { spaceId: req.params.spaceId } }); const contributors = await prisma.page.groupBy({ by: ['updatedById'], where: { spaceId: req.params.spaceId }, _count: true }); ok(res, { pages, contributors }); })
};
