import multer from 'multer';
import { prisma } from '@pm-platform/db';
import { env } from '../config/env.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';
import { storageService } from '../services/storage.service.js';
import { emitToProject } from '../sockets/index.js';

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 } });
const userSummary = { select: { id: true, email: true, name: true, avatarUrl: true } };

export const attachmentsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.attachment.findMany({ where: { issueId: String(req.params.issueId) }, include: { user: userSummary }, orderBy: { createdAt: 'desc' } }))),
  create: asyncHandler(async (req, res) => {
    const issueId = String(req.params.issueId);
    const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { projectId: true } });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const file = req.file;
    if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Attachment file is required');
    const stored = await storageService.putAttachment(file);
    const attachment = await prisma.attachment.create({ data: { issueId, userId: req.user!.id, filename: file.originalname, mimeType: file.mimetype, sizeBytes: BigInt(file.size), bucketKey: stored.key }, include: { user: userSummary } });
    await prisma.issueHistory.create({ data: { issueId, userId: req.user!.id, field: 'attachment.added', oldValue: null, newValue: file.originalname } });
    emitToProject(issue.projectId, 'issue:updated', { id: issueId, attachment });
    created(res, attachment);
  }),
  url: asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findFirst({ where: { id: String(req.params.attachmentId), issueId: String(req.params.issueId) } });
    if (!attachment) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
    ok(res, { url: await storageService.presignedAttachmentUrl(attachment.bucketKey) });
  }),
  remove: asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findFirst({ where: { id: String(req.params.attachmentId), issueId: String(req.params.issueId) }, include: { issue: true } });
    if (!attachment) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
    if (attachment.userId !== req.user!.id && req.user!.role === 'MEMBER') throw new AppError(403, 'FORBIDDEN', 'Only uploader or admin can delete');
    await storageService.removeAttachment(attachment.bucketKey);
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await prisma.issueHistory.create({ data: { issueId: attachment.issueId!, userId: req.user!.id, field: 'attachment.removed', oldValue: attachment.filename, newValue: null } });
    emitToProject(attachment.issue!.projectId, 'issue:updated', { id: attachment.issueId, attachmentDeleted: attachment.id });
    noContent(res);
  })
};
