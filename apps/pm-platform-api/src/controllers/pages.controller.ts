import { prisma } from '@pm-platform/db';
import { pageService } from '../services/page.service.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

export const pagesController = {
  tree: asyncHandler(async (req, res) => {
    await pageService.assertSpaceMember(req.params.spaceId, req.user!.id);

    const pages = await prisma.page.findMany({
      where: { spaceId: req.params.spaceId, isArchived: false },
      orderBy: [{ parentId: 'asc' }, { title: 'asc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        restrictions: true,
        _count: { select: { children: true, comments: true, versions: true } }
      }
    });

    ok(res, pages);
  }),

  create: asyncHandler(async (req, res) => created(res, await pageService.create(req.params.spaceId, req.user!.id, req.body))),

  get: asyncHandler(async (req, res) => {
    await pageService.assertPageAccess(req.params.spaceId, req.params.pageId, req.user!.id, 'VIEW');

    const page = await prisma.page.findFirst({
      where: { id: req.params.pageId, spaceId: req.params.spaceId, isArchived: false },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        restrictions: { include: { user: { select: { id: true, name: true, email: true } } } },
        comments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        versions: { orderBy: { version: 'desc' }, take: 20, include: { createdBy: { select: { id: true, name: true, email: true } } } },
        attachments: true,
        watches: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });

    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');
    ok(res, page);
  }),

  update: asyncHandler(async (req, res) => ok(res, await pageService.update(req.params.spaceId, req.params.pageId, req.user!.id, req.body))),

  remove: asyncHandler(async (req, res) => {
    await pageService.assertPageAccess(req.params.spaceId, req.params.pageId, req.user!.id, 'EDIT');
    await prisma.page.update({ where: { id: req.params.pageId }, data: { isArchived: true } });
    noContent(res);
  }),

  versions: asyncHandler(async (req, res) => {
    await pageService.assertPageAccess(req.params.spaceId, req.params.pageId, req.user!.id, 'VIEW');
    ok(res, await prisma.pageVersion.findMany({
      where: { pageId: req.params.pageId },
      orderBy: { version: 'desc' },
      include: { createdBy: { select: { id: true, name: true, email: true } } }
    }));
  }),

  restore: asyncHandler(async (req, res) => ok(res, await pageService.restore(req.params.spaceId, req.params.pageId, Number(req.params.v), req.user!.id))),

  restrictions: asyncHandler(async (req, res) => ok(res, await pageService.listRestrictions(req.params.spaceId, req.params.pageId, req.user!.id))),

  createRestriction: asyncHandler(async (req, res) => created(res, await pageService.createRestriction(req.params.spaceId, req.params.pageId, req.user!.id, req.body))),

  deleteRestriction: asyncHandler(async (req, res) => { await pageService.deleteRestriction(req.params.spaceId, req.params.pageId, req.params.restrictionId, req.user!.id); noContent(res); }),

  comments: asyncHandler(async (req, res) => ok(res, await pageService.listComments(req.params.spaceId, req.params.pageId, req.user!.id))),

  createComment: asyncHandler(async (req, res) => created(res, await pageService.createComment(req.params.spaceId, req.params.pageId, req.user!.id, req.body))),

  resolveComment: asyncHandler(async (req, res) => ok(res, await pageService.resolveComment(req.params.spaceId, req.params.pageId, req.params.commentId, req.user!.id))),

  embedIssue: asyncHandler(async (req, res) => ok(res, await pageService.embedIssue(req.params.spaceId, req.params.pageId, req.user!.id, req.body))),

  collabState: asyncHandler(async (req, res) => ok(res, await pageService.getCollabState(req.params.spaceId, req.params.pageId, req.user!.id))),

  collabPresence: asyncHandler(async (req, res) => ok(res, await pageService.touchPresence(req.params.spaceId, req.params.pageId, req.user!))),

  exportPdf: asyncHandler(async (req, res) => {
    await pageService.assertPageAccess(req.params.spaceId, req.params.pageId, req.user!.id, 'VIEW');
    const pdf = await pageService.exportPdf(req.params.pageId);
    res.header('Content-Type', 'application/pdf');
    res.attachment('page.pdf');
    res.send(pdf);
  }),

  exportDocx: asyncHandler(async (req, res) => {
    await pageService.assertPageAccess(req.params.spaceId, req.params.pageId, req.user!.id, 'VIEW');
    const doc = await pageService.exportDocx(req.params.pageId);
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.attachment('page.docx');
    res.send(doc);
  }),

  share: asyncHandler(async (req, res) => ok(res, await pageService.share(req.params.spaceId, req.params.pageId, req.user!.id))),

  shared: asyncHandler(async (req, res) => ok(res, await pageService.getShared(req.params.token)))
};
