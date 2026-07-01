import { prisma, GlobalRole } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { emitToProject } from '../sockets/index.js';

const userSummary = { select: { id: true, email: true, name: true, avatarUrl: true, role: true } };
const issueSummary = { select: { id: true, key: true, title: true, projectId: true, originalEstimate: true, remainingEstimate: true } };
const worklogInclude = { user: userSummary, issue: issueSummary };

type WorklogInput = { timeSpent: number; dateStarted: string; description?: string | null };
type WorklogUpdateInput = { timeSpent?: number; dateStarted?: string; description?: string | null };

function normalizeSeconds(value: unknown) {
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds <= 0) throw new AppError(422, 'INVALID_TIME_SPENT', 'timeSpent must be a positive integer number of seconds');
  return seconds;
}

function normalizeDate(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError(422, 'INVALID_DATE_STARTED', 'dateStarted must be a valid date/time');
  return date;
}

async function assertIssue(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true, key: true, projectId: true, originalEstimate: true, remainingEstimate: true } });
  if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  return issue;
}

async function recalcRemainingEstimate(tx: any, issueId: string) {
  const issue = await tx.issue.findUnique({ where: { id: issueId }, select: { originalEstimate: true } });
  if (!issue || issue.originalEstimate == null) return null;
  const aggregate = await tx.worklog.aggregate({ where: { issueId }, _sum: { timeSpent: true } });
  const logged = aggregate._sum.timeSpent ?? 0;
  const remainingEstimate = Math.max(issue.originalEstimate - logged, 0);
  await tx.issue.update({ where: { id: issueId }, data: { remainingEstimate } });
  return { remainingEstimate, logged };
}

function worklogSnapshot(value: { timeSpent: number; dateStarted: Date | string; description?: string | null }) {
  return JSON.stringify({
    timeSpent: value.timeSpent,
    dateStarted: value.dateStarted instanceof Date ? value.dateStarted.toISOString() : value.dateStarted,
    description: value.description ?? null
  });
}

async function assertEditable(worklogId: string, userId: string, isAdmin: boolean) {
  const worklog = await prisma.worklog.findUnique({ where: { id: worklogId }, include: { issue: { select: { id: true, key: true, projectId: true } } } });
  if (!worklog) throw new AppError(404, 'WORKLOG_NOT_FOUND', 'Worklog not found');
  if (!isAdmin && worklog.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Can only edit own worklog');
  return worklog;
}

export const worklogService = {
  async list(issueId: string) {
    await assertIssue(issueId);
    return prisma.worklog.findMany({ where: { issueId }, include: worklogInclude, orderBy: { dateStarted: 'desc' } });
  },

  async create(issueId: string, userId: string, input: WorklogInput) {
    const issue = await assertIssue(issueId);
    const timeSpent = normalizeSeconds(input.timeSpent);
    const dateStarted = normalizeDate(input.dateStarted);
    const description = input.description ?? null;

    const worklog = await prisma.$transaction(async (tx) => {
      const created = await tx.worklog.create({
        data: { issueId, userId, timeSpent, dateStarted, description },
        include: worklogInclude
      });
      await tx.issueHistory.create({
        data: {
          issueId,
          userId,
          field: 'worklog.added',
          oldValue: null,
          newValue: worklogSnapshot(created)
        }
      });
      const estimate = await recalcRemainingEstimate(tx, issueId);
      if (estimate) {
        await tx.issueHistory.create({
          data: { issueId, userId, field: 'remainingEstimate', oldValue: issue.remainingEstimate == null ? null : String(issue.remainingEstimate), newValue: String(estimate.remainingEstimate) }
        });
      }
      return created;
    });

    emitToProject(issue.projectId, 'issue:updated', { id: issueId, projectId: issue.projectId, worklogChanged: true });
    return worklog;
  },

  async update(worklogId: string, userId: string, isAdmin: boolean, input: WorklogUpdateInput) {
    const current = await assertEditable(worklogId, userId, isAdmin);
    const beforeIssue = await prisma.issue.findUnique({ where: { id: current.issueId }, select: { remainingEstimate: true, projectId: true } });
    const data: any = {};
    if (input.timeSpent !== undefined) data.timeSpent = normalizeSeconds(input.timeSpent);
    if (input.dateStarted !== undefined) data.dateStarted = normalizeDate(input.dateStarted);
    if (input.description !== undefined) data.description = input.description ?? null;
    if (!Object.keys(data).length) return prisma.worklog.findUniqueOrThrow({ where: { id: worklogId }, include: worklogInclude });

    const worklog = await prisma.$transaction(async (tx) => {
      const updated = await tx.worklog.update({ where: { id: worklogId }, data, include: worklogInclude });
      await tx.issueHistory.create({
        data: {
          issueId: current.issueId,
          userId,
          field: 'worklog.updated',
          oldValue: worklogSnapshot(current),
          newValue: worklogSnapshot(updated)
        }
      });
      const estimate = await recalcRemainingEstimate(tx, current.issueId);
      if (estimate && String(beforeIssue?.remainingEstimate ?? '') !== String(estimate.remainingEstimate)) {
        await tx.issueHistory.create({
          data: { issueId: current.issueId, userId, field: 'remainingEstimate', oldValue: beforeIssue?.remainingEstimate == null ? null : String(beforeIssue.remainingEstimate), newValue: String(estimate.remainingEstimate) }
        });
      }
      return updated;
    });

    emitToProject(current.issue.projectId, 'issue:updated', { id: current.issueId, projectId: current.issue.projectId, worklogChanged: true });
    return worklog;
  },

  async delete(worklogId: string, userId: string, isAdmin: boolean) {
    const current = await assertEditable(worklogId, userId, isAdmin);
    const beforeIssue = await prisma.issue.findUnique({ where: { id: current.issueId }, select: { remainingEstimate: true, projectId: true } });

    await prisma.$transaction(async (tx) => {
      await tx.worklog.delete({ where: { id: worklogId } });
      await tx.issueHistory.create({
        data: {
          issueId: current.issueId,
          userId,
          field: 'worklog.deleted',
          oldValue: worklogSnapshot(current),
          newValue: null
        }
      });
      const estimate = await recalcRemainingEstimate(tx, current.issueId);
      if (estimate && String(beforeIssue?.remainingEstimate ?? '') !== String(estimate.remainingEstimate)) {
        await tx.issueHistory.create({
          data: { issueId: current.issueId, userId, field: 'remainingEstimate', oldValue: beforeIssue?.remainingEstimate == null ? null : String(beforeIssue.remainingEstimate), newValue: String(estimate.remainingEstimate) }
        });
      }
    });

    emitToProject(current.issue.projectId, 'issue:updated', { id: current.issueId, projectId: current.issue.projectId, worklogChanged: true });
    return { deleted: true };
  }
};

export function isWorklogAdmin(role: GlobalRole) {
  return role === GlobalRole.ADMIN || role === GlobalRole.SUPER_ADMIN;
}
