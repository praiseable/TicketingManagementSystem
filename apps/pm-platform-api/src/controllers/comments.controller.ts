import { prisma, NotificationType } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';
import { notificationService } from '../services/notification.service.js';
import { emitToProject } from '../sockets/index.js';

const userSummary = { select: { id: true, email: true, name: true, avatarUrl: true } };

async function notifyMentions(body: string, commentId: string) {
  const emails = Array.from(
    new Set([...body.matchAll(/@([\w.+-]+@[\w.-]+)/g)].map((m) => m[1].toLowerCase()))
  );

  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) continue;

    const existing = await prisma.mention.findFirst({
      where: {
        commentId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      await prisma.mention.create({
        data: {
          commentId,
          userId: user.id,
        },
      });
    }

    await notificationService.notify(
      user.id,
      NotificationType.ISSUE_MENTIONED,
      'You were mentioned',
      body.slice(0, 140),
      'comment',
      commentId
    );
  }
}

async function issueProject(issueId: string) {
  return prisma.issue.findUnique({ where: { id: issueId }, select: { projectId: true, key: true, title: true } });
}

export const commentsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.comment.findMany({ where: { issueId: String(req.params.issueId), parentId: null }, include: { user: userSummary, replies: { include: { user: userSummary }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } }))),
  create: asyncHandler(async (req, res) => {
    const issueId = String(req.params.issueId);
    const issue = await issueProject(issueId);
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const comment = await prisma.comment.create({ data: { issueId, userId: req.user!.id, body: req.body.body, parentId: req.body.parentId ?? null }, include: { user: userSummary, replies: true } });
    await prisma.issueHistory.create({ data: { issueId, userId: req.user!.id, field: 'comment', oldValue: null, newValue: comment.body.slice(0, 200) } });
    await notifyMentions(req.body.body, comment.id);
    emitToProject(issue.projectId, 'issue:updated', { id: issueId, comment });
    created(res, comment);
  }),
  update: asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: String(req.params.commentId) }, include: { issue: true } });
    if (!comment || comment.issueId !== String(req.params.issueId)) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    if (comment.userId !== req.user!.id && req.user!.role === 'MEMBER') throw new AppError(403, 'FORBIDDEN', 'Only author or admin can edit');
    const updated = await prisma.comment.update({ where: { id: comment.id }, data: { body: req.body.body, isEdited: true }, include: { user: userSummary, replies: { include: { user: userSummary } } } });
    await prisma.issueHistory.create({ data: { issueId: comment.issueId, userId: req.user!.id, field: 'comment.edited', oldValue: comment.body.slice(0, 200), newValue: updated.body.slice(0, 200) } });
    emitToProject(comment.issue.projectId, 'issue:updated', { id: comment.issueId, comment: updated });
    ok(res, updated);
  }),
  remove: asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: String(req.params.commentId) }, include: { issue: true } });
    if (!comment || comment.issueId !== String(req.params.issueId)) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    if (comment.userId !== req.user!.id && req.user!.role === 'MEMBER') throw new AppError(403, 'FORBIDDEN', 'Only author or admin can delete');
    await prisma.comment.delete({ where: { id: comment.id } });
    await prisma.issueHistory.create({ data: { issueId: comment.issueId, userId: req.user!.id, field: 'comment.deleted', oldValue: comment.body.slice(0, 200), newValue: null } });
    emitToProject(comment.issue.projectId, 'issue:updated', { id: comment.issueId, commentDeleted: comment.id });
    noContent(res);
  })
};
