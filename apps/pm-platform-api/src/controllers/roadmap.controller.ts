import { prisma } from '@pm-platform/db';
import { asyncHandler, ok, AppError } from '../utils/apiResponse.js';
import { settingsStore } from '../services/settings-store.service.js';

function asString(value: unknown): string {
  if (Array.isArray(value)) return asString(value[0]);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new AppError(400, 'PARAM_REQUIRED', 'Required parameter missing');
}

function dateOrNull(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const roadmapController = {
  timeline: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    const project = await settingsStore.getProject(projectId);
    if (!project || project.orgId !== req.user!.orgId) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    const schedule = (project.settings.roadmap?.issueSchedule ?? {}) as Record<string, any>;
    const issues = await prisma.issue.findMany({
      where: { projectId },
      include: { assignee: { select: { id: true, name: true, email: true } }, workflowStatus: true, issueType: true, sprint: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });
    ok(res, {
      project: { id: project.id, key: project.key, name: project.name },
      items: issues.map((issue) => {
        const saved = schedule[issue.id] ?? {};
        const endDate = dateOrNull(saved.endDate) ?? issue.dueDate ?? addDays(issue.createdAt, 7);
        const startDate = dateOrNull(saved.startDate) ?? addDays(endDate, -7);
        return { id: issue.id, key: issue.key, title: issue.title, startDate, endDate, dueDate: issue.dueDate, priority: issue.priority, storyPoints: issue.storyPoints, assignee: issue.assignee, status: issue.workflowStatus, issueType: issue.issueType, sprint: issue.sprint };
      })
    });
  }),

  reschedule: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    const issueId = asString((req.params as any).issueId);
    const startDate = dateOrNull(req.body?.startDate);
    const endDate = dateOrNull(req.body?.endDate);
    if (!startDate || !endDate) throw new AppError(400, 'INVALID_DATE_RANGE', 'startDate and endDate are required');
    const issue = await prisma.issue.findFirst({ where: { id: issueId, projectId }, select: { id: true, key: true, dueDate: true, project: { select: { orgId: true } } } });
    if (!issue || issue.project.orgId !== req.user!.orgId) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    await settingsStore.updateProject(projectId, (settings) => {
      settings.roadmap = settings.roadmap || {};
      settings.roadmap.issueSchedule = settings.roadmap.issueSchedule || {};
      settings.roadmap.issueSchedule[issueId] = { startDate: startDate.toISOString(), endDate: endDate.toISOString(), updatedById: req.user!.id, updatedAt: new Date().toISOString() };
    });
    const updated = await prisma.issue.update({ where: { id: issueId }, data: { dueDate: endDate }, include: { workflowStatus: true, assignee: { select: { id: true, email: true, name: true } } } });
    await prisma.issueHistory.create({ data: { issueId, userId: req.user!.id, field: 'roadmap.schedule', oldValue: issue.dueDate?.toISOString() ?? null, newValue: JSON.stringify({ startDate: startDate.toISOString(), endDate: endDate.toISOString() }) } });
    ok(res, { issue: updated, schedule: { startDate, endDate } });
  }),
};
