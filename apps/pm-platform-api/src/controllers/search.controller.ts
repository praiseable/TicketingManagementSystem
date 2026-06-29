import { prisma } from '@pm-platform/db';
import { searchService } from '../services/search.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const searchController = {
  global: asyncHandler(async (req, res) => ok(res, await searchService.global(String(req.query.q ?? ''), { projectId: req.query.projectId ? String(req.query.projectId) : undefined, type: req.query.type ? String(req.query.type) : undefined }))),
  issues: asyncHandler(async (req, res) => ok(res, await searchService.issues(String(req.query.q ?? ''), req.query.filters ? JSON.parse(String(req.query.filters)) : {}, Number(req.query.page ?? 1), Number(req.query.limit ?? 25)))),
  saveFilter: asyncHandler(async (req, res) => created(res, await prisma.savedFilter.create({ data: { userId: req.user!.id, ...req.body } }))),
  filters: asyncHandler(async (req, res) => ok(res, await prisma.savedFilter.findMany({ where: { userId: req.user!.id }, orderBy: { updatedAt: 'desc' } }))),
  deleteFilter: asyncHandler(async (req, res) => { await prisma.savedFilter.delete({ where: { id: req.params.id } }); noContent(res); })
};
