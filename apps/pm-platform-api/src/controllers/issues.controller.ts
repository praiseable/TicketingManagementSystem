import { prisma, NotificationType, StatusCategory } from '@pm-platform/db';
import { issueService } from '../services/issue.service.js';
import { workflowService } from '../services/workflow.service.js';
import { notificationService } from '../services/notification.service.js';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

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

function splitLabels(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
}

async function replaceBulkLabels(tx: any, projectId: string, issueId: string, labels: string[]) {
  await tx.issueLabel.deleteMany({ where: { issueId } });
  for (const name of labels) {
    const label = await tx.label.upsert({
      where: { projectId_name: { projectId, name } },
      update: {},
      create: { projectId, name, color: '#64748b' }
    });
    await tx.issueLabel.upsert({ where: { issueId_labelId: { issueId, labelId: label.id } }, update: {}, create: { issueId, labelId: label.id } });
  }
}

async function bulkIssues(projectId: string, userId: string, input: { issueIds: string[]; action: string; value?: any }) {
  const issueIds = Array.from(new Set(input.issueIds ?? []));
  if (!issueIds.length) throw new AppError(400, 'NO_ISSUES_SELECTED', 'No issues selected');

  const issues = await prisma.issue.findMany({ where: { projectId, id: { in: issueIds } }, include: { labels: { include: { label: true } }, workflowStatus: true } });
  if (issues.length !== issueIds.length) throw new AppError(404, 'ISSUES_NOT_FOUND', 'One or more selected issues were not found in this project');

  if (input.action === 'DELETE') {
    const res = await prisma.issue.deleteMany({ where: { projectId, id: { in: issueIds } } });
    return { updated: res.count };
  }

  if (input.action === 'STATUS') {
    const toStatusId = String(input.value ?? '');
    const status = await prisma.workflowStatus.findFirst({ where: { id: toStatusId, workflow: { projectId } } });
    if (!status) throw new AppError(422, 'INVALID_STATUS', 'Target status does not belong to this project');
    let updated = 0;
    for (const issue of issues) {
      if (issue.workflowStatusId !== toStatusId) {
        await workflowService.executeTransition(issue.id, toStatusId, userId, 'Bulk status update');
        updated += 1;
      }
    }
    return { updated };
  }

  if (input.action === 'LABEL') {
    const labels = splitLabels(input.value);
    await prisma.$transaction(async (tx) => {
      for (const issue of issues) {
        const oldValue = issue.labels.map((x) => x.label.name).join(', ');
        await replaceBulkLabels(tx, projectId, issue.id, labels);
        await tx.issueHistory.create({ data: { issueId: issue.id, userId, field: 'labels', oldValue, newValue: labels.join(', ') } });
      }
    });
    return { updated: issues.length };
  }

  if (input.action === 'ASSIGN') {
    const assigneeId = input.value ? String(input.value) : null;
    if (assigneeId) {
      const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } } });
      if (!member) throw new AppError(422, 'ASSIGNEE_NOT_MEMBER', 'Assignee must be a project member');
    }
    await prisma.$transaction(async (tx) => {
      for (const issue of issues) {
        await tx.issue.update({ where: { id: issue.id }, data: { assigneeId } });
        await tx.issueHistory.create({ data: { issueId: issue.id, userId, field: 'assigneeId', oldValue: issue.assigneeId, newValue: assigneeId } });
      }
    });
    if (assigneeId) {
      for (const issue of issues) {
        await notificationService.notify(assigneeId, NotificationType.ISSUE_ASSIGNED, `${issue.key} assigned`, issue.title, 'issue', issue.id).catch(() => undefined);
      }
    }
    return { updated: issues.length };
  }

  if (input.action === 'PRIORITY') {
    const priority = String(input.value ?? '');
    if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(priority)) throw new AppError(422, 'INVALID_PRIORITY', 'Invalid priority');
    await prisma.$transaction(async (tx) => {
      for (const issue of issues) {
        await tx.issue.update({ where: { id: issue.id }, data: { priority: priority as never } });
        await tx.issueHistory.create({ data: { issueId: issue.id, userId, field: 'priority', oldValue: issue.priority, newValue: priority } });
      }
    });
    return { updated: issues.length };
  }

  throw new AppError(422, 'UNSUPPORTED_BULK_ACTION', 'Unsupported bulk action');
}

export const issuesController = {
  list: asyncHandler(async (req, res) => {
    const result = await issueService.list(projectIdFromReq(req), req.query);
    ok(res, result.data, result.meta);
  }),
  create: asyncHandler(async (req, res) => created(res, await issueService.create(projectIdFromReq(req), req.user!.id, req.body))),
  get: asyncHandler(async (req, res) => ok(res, await issueService.get(projectIdFromReq(req), issueIdFromReq(req)))),
  update: asyncHandler(async (req, res) => ok(res, await issueService.update(projectIdFromReq(req), issueIdFromReq(req), req.user!.id, req.body))),
  remove: asyncHandler(async (req, res) => { await issueService.delete(projectIdFromReq(req), issueIdFromReq(req)); noContent(res); }),
  transition: asyncHandler(async (req, res) => ok(res, await issueService.transition(issueIdFromReq(req), req.body.toStatusId, req.user!.id, req.body.comment))),
  link: asyncHandler(async (req, res) => created(res, await issueService.link(issueIdFromReq(req), req.user!.id, req.body))),
  unlink: asyncHandler(async (req, res) => { await prisma.issueLink.delete({ where: { id: paramString(req.params.linkId)! } }); noContent(res); }),
  history: asyncHandler(async (req, res) => ok(res, await prisma.issueHistory.findMany({ where: { issueId: issueIdFromReq(req) }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } }))),
  watch: asyncHandler(async (req, res) => { await prisma.issueWatcher.upsert({ where: { issueId_userId: { issueId: issueIdFromReq(req), userId: req.user!.id } }, update: {}, create: { issueId: issueIdFromReq(req), userId: req.user!.id } }); noContent(res); }),
  unwatch: asyncHandler(async (req, res) => { await prisma.issueWatcher.deleteMany({ where: { issueId: issueIdFromReq(req), userId: req.user!.id } }); noContent(res); }),
  bulk: asyncHandler(async (req, res) => ok(res, await bulkIssues(projectIdFromReq(req), req.user!.id, req.body)))
};
