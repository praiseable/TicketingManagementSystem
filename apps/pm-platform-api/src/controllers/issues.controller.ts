import { prisma } from '@pm-platform/db';
import { issueService } from '../services/issue.service.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}/i;

function paramString(value: unknown): string | undefined {
  if (Array.isArray(value)) return paramString(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function projectIdFromReq(req: any): string {
  const direct = paramString(req.params?.projectId) ?? paramString(req.params?.id);
  if (direct) return direct;
  const match = String(req.originalUrl ?? '').match(/\/projects\/([^/]+)/i);
  if (match?.[1] && uuidRe.test(match[1])) return match[1];
  throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required');
}

function issueIdFromReq(req: any): string {
  const id = paramString(req.params?.issueId);
  if (id) return id;
  throw new AppError(400, 'ISSUE_ID_REQUIRED', 'Issue id is required');
}

export const issuesController = {
  list: asyncHandler(async (req, res) => {
    const result = await issueService.list(projectIdFromReq(req), req.query);
    ok(res, result.data, result.meta);
  }),
  create: asyncHandler(async (req, res) => created(res, await issueService.create(projectIdFromReq(req), req.user!.id, req.body))),
  get: asyncHandler(async (req, res) => ok(res, await issueService.get(projectIdFromReq(req), issueIdFromReq(req)))),
  update: asyncHandler(async (req, res) => ok(res, await issueService.update(projectIdFromReq(req), issueIdFromReq(req), req.user!.id, req.body))),
  remove: asyncHandler(async (req, res) => { await issueService.delete(projectIdFromReq(req), issueIdFromReq(req), req.user!.id, req.user!.role as any); noContent(res); }),
  transition: asyncHandler(async (req, res) => ok(res, await issueService.transition(issueIdFromReq(req), req.body.toStatusId, req.user!.id, req.body.comment))),
  link: asyncHandler(async (req, res) => created(res, await issueService.link(issueIdFromReq(req), req.user!.id, req.body))),
  unlink: asyncHandler(async (req, res) => { await issueService.unlink(issueIdFromReq(req), paramString(req.params.linkId)!, req.user!.id); noContent(res); }),
  history: asyncHandler(async (req, res) => ok(res, await prisma.issueHistory.findMany({ where: { issueId: issueIdFromReq(req) }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } }))),
  watch: asyncHandler(async (req, res) => { await prisma.issueWatcher.upsert({ where: { issueId_userId: { issueId: issueIdFromReq(req), userId: req.user!.id } }, update: {}, create: { issueId: issueIdFromReq(req), userId: req.user!.id } }); noContent(res); }),
  unwatch: asyncHandler(async (req, res) => { await prisma.issueWatcher.deleteMany({ where: { issueId: issueIdFromReq(req), userId: req.user!.id } }); noContent(res); }),
  bulk: asyncHandler(async (req, res) => ok(res, await issueService.bulk(projectIdFromReq(req), req.user!.id, req.body)))
};
