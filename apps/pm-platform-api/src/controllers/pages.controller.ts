import crypto from 'node:crypto';
import { prisma } from '@pm-platform/db';
import { pageService } from '../services/page.service.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

export const pagesController = {
  tree: asyncHandler(async (req, res) => ok(res, await prisma.page.findMany({ where: { spaceId: req.params.spaceId, isArchived: false }, orderBy: [{ parentId: 'asc' }, { title: 'asc' }] }))),
  create: asyncHandler(async (req, res) => created(res, await pageService.create(req.params.spaceId, req.user!.id, req.body))),
  get: asyncHandler(async (req, res) => { const page = await prisma.page.findFirst({ where: { id: req.params.pageId, spaceId: req.params.spaceId }, include: { comments: { include: { user: { select: { id: true, name: true, email: true } } } }, versions: { orderBy: { version: 'desc' }, take: 10 } } }); if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found'); ok(res, page); }),
  update: asyncHandler(async (req, res) => ok(res, await pageService.update(req.params.spaceId, req.params.pageId, req.user!.id, req.body))),
  remove: asyncHandler(async (req, res) => { await prisma.page.update({ where: { id: req.params.pageId }, data: { isArchived: true } }); noContent(res); }),
  versions: asyncHandler(async (req, res) => ok(res, await prisma.pageVersion.findMany({ where: { pageId: req.params.pageId }, orderBy: { version: 'desc' } }))),
  restore: asyncHandler(async (req, res) => ok(res, await pageService.restore(req.params.spaceId, req.params.pageId, Number(req.params.v), req.user!.id))),
  exportPdf: asyncHandler(async (req, res) => { const pdf = await pageService.exportPdf(req.params.pageId); res.header('Content-Type', 'application/pdf'); res.attachment('page.pdf'); res.send(pdf); }),
  exportDocx: asyncHandler(async (req, res) => { const doc = await pageService.exportDocx(req.params.pageId); res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); res.attachment('page.docx'); res.send(doc); }),
  share: asyncHandler(async (_req, res) => ok(res, { shareToken: crypto.randomBytes(24).toString('hex') })),
  shared: asyncHandler(async (req, res) => ok(res, await prisma.page.findFirst({ where: { id: req.params.token } })))
};
