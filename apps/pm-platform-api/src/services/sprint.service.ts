import { prisma, SprintStatus, StatusCategory } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';

const userSummary = { select: { id: true, email: true, name: true, avatarUrl: true, role: true } };
const issueInclude = {
  issueType: true,
  workflowStatus: true,
  assignee: userSummary,
  reporter: userSummary,
  labels: { include: { label: true } },
  _count: { select: { comments: true, attachments: true, watchers: true, children: true } }
};

function asDate(value: string | Date, field: string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(422, 'INVALID_DATE', `${field} is not a valid date`);
  return d;
}

async function assertProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  return project;
}

async function assertSprint(projectId: string, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) throw new AppError(404, 'SPRINT_NOT_FOUND', 'Sprint not found');
  return sprint;
}

function normalizePosition(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const sprintService = {
  async list(projectId: string) {
    await assertProject(projectId);
    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        issues: { include: issueInclude, orderBy: [{ workflowStatus: { position: 'asc' } }, { position: 'asc' }] },
        sprintIssues: true,
        _count: { select: { issues: true, sprintIssues: true } }
      }
    });
    return sprints.map((sprint) => ({
      ...sprint,
      committedStoryPoints: sprint.issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0),
      completedStoryPoints: sprint.issues.filter((issue) => issue.workflowStatus.category === StatusCategory.DONE || issue.resolvedAt).reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0)
    }));
  },

  async create(projectId: string, input: any) {
    await assertProject(projectId);
    const startDate = asDate(input.startDate, 'startDate');
    const endDate = asDate(input.endDate, 'endDate');
    if (endDate <= startDate) throw new AppError(422, 'INVALID_SPRINT_DATES', 'Sprint end date must be after start date');
    return prisma.sprint.create({
      data: {
        projectId,
        name: input.name,
        goal: input.goal ?? null,
        capacity: input.capacity == null ? 0 : Number(input.capacity),
        startDate,
        endDate,
        status: SprintStatus.DRAFT
      }
    });
  },

  async get(projectId: string, sprintId: string) {
    await assertSprint(projectId, sprintId);
    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: {
        issues: { include: issueInclude, orderBy: [{ workflowStatus: { position: 'asc' } }, { position: 'asc' }] },
        sprintIssues: { include: { issue: { include: issueInclude } }, orderBy: { addedAt: 'asc' } }
      }
    });
    return sprint;
  },

  async update(projectId: string, sprintId: string, input: any) {
    const sprint = await assertSprint(projectId, sprintId);
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.goal !== undefined) data.goal = input.goal;
    if (input.capacity !== undefined) data.capacity = input.capacity == null ? 0 : Number(input.capacity);
    if (input.startDate !== undefined) data.startDate = asDate(input.startDate, 'startDate');
    if (input.endDate !== undefined) data.endDate = asDate(input.endDate, 'endDate');
    if (input.status !== undefined) data.status = input.status;
    const start = data.startDate ?? sprint.startDate;
    const end = data.endDate ?? sprint.endDate;
    if (end <= start) throw new AppError(422, 'INVALID_SPRINT_DATES', 'Sprint end date must be after start date');
    return prisma.sprint.update({ where: { id: sprintId }, data });
  },

  async start(projectId: string, sprintId: string) {
    const sprint = await assertSprint(projectId, sprintId);
    if (sprint.status === SprintStatus.COMPLETED) throw new AppError(409, 'SPRINT_ALREADY_COMPLETED', 'Completed sprint cannot be started');
    const active = await prisma.sprint.findFirst({ where: { projectId, status: SprintStatus.ACTIVE, NOT: { id: sprintId } } });
    if (active) throw new AppError(409, 'ACTIVE_SPRINT_EXISTS', 'Only one sprint can be active per project at a time');
    return prisma.sprint.update({ where: { id: sprintId }, data: { status: SprintStatus.ACTIVE } });
  },

  async addIssues(projectId: string, sprintId: string | null, issueIds: string[], userId?: string) {
    await assertProject(projectId);
    if (sprintId) await assertSprint(projectId, sprintId);
    const issues = await prisma.issue.findMany({ where: { id: { in: issueIds }, projectId }, select: { id: true, sprintId: true, position: true } });
    if (issues.length !== issueIds.length) throw new AppError(404, 'ISSUE_NOT_FOUND', 'One or more issues do not belong to this project');
    await prisma.$transaction(async (tx) => {
      for (let idx = 0; idx < issues.length; idx++) {
        const issue = issues[idx];
        await tx.issue.update({ where: { id: issue.id }, data: { sprintId, position: normalizePosition(issue.position, 0) + idx / 1000 } });
        if (sprintId) {
          await tx.sprintIssue.upsert({
            where: { sprintId_issueId: { sprintId, issueId: issue.id } },
            update: {},
            create: { sprintId, issueId: issue.id }
          });
        }
        if (!sprintId) await tx.sprintIssue.deleteMany({ where: { issueId: issue.id, sprint: { projectId, status: { not: SprintStatus.COMPLETED } } } });
        if (userId && issue.sprintId !== sprintId) {
          await tx.issueHistory.create({ data: { issueId: issue.id, userId, field: 'sprintId', oldValue: issue.sprintId, newValue: sprintId } });
        }
      }
    });
    return { moved: issues.length };
  },

  async complete(projectId: string, sprintId: string, moveToSprintId?: string | null) {
    const sprint = await assertSprint(projectId, sprintId);
    if (sprint.status !== SprintStatus.ACTIVE) throw new AppError(409, 'SPRINT_NOT_ACTIVE', 'Only an active sprint can be completed');
    if (moveToSprintId) await assertSprint(projectId, moveToSprintId);

    const issues = await prisma.issue.findMany({
      where: { projectId, sprintId },
      include: { workflowStatus: true }
    });
    const incomplete = issues.filter((issue) => issue.workflowStatus.category !== StatusCategory.DONE && !issue.resolvedAt);
    const completed = issues.filter((issue) => issue.workflowStatus.category === StatusCategory.DONE || issue.resolvedAt);

    await prisma.$transaction(async (tx) => {
      for (const issue of completed) {
        await tx.sprintIssue.upsert({
          where: { sprintId_issueId: { sprintId, issueId: issue.id } },
          update: { completedInSprint: true },
          create: { sprintId, issueId: issue.id, completedInSprint: true }
        });
      }
      for (const issue of incomplete) {
        await tx.issue.update({ where: { id: issue.id }, data: { sprintId: moveToSprintId ?? null } });
        await tx.sprintIssue.upsert({
          where: { sprintId_issueId: { sprintId, issueId: issue.id } },
          update: { completedInSprint: false },
          create: { sprintId, issueId: issue.id, completedInSprint: false }
        });
        if (moveToSprintId) {
          await tx.sprintIssue.upsert({
            where: { sprintId_issueId: { sprintId: moveToSprintId, issueId: issue.id } },
            update: {},
            create: { sprintId: moveToSprintId, issueId: issue.id }
          });
        }
      }
      await tx.sprint.update({ where: { id: sprintId }, data: { status: SprintStatus.COMPLETED, completedAt: new Date() } });
    });

    return {
      sprint: await prisma.sprint.findUnique({ where: { id: sprintId } }),
      movedIssues: incomplete.length,
      completedIssues: completed.length
    };
  },

  async delete(projectId: string, sprintId: string) {
    const sprint = await assertSprint(projectId, sprintId);
    if (sprint.status === SprintStatus.ACTIVE) throw new AppError(409, 'ACTIVE_SPRINT_DELETE_BLOCKED', 'Active sprint must be completed or cancelled before delete');
    await prisma.issue.updateMany({ where: { projectId, sprintId }, data: { sprintId: null } });
    await prisma.sprint.delete({ where: { id: sprintId } });
  },

  async burndown(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, include: { issues: { include: { workflowStatus: true } } } });
    if (!sprint) throw new AppError(404, 'SPRINT_NOT_FOUND', 'Sprint not found');
    const total = sprint.issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    const days = Math.max(Math.ceil((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86400000), 1);
    return Array.from({ length: days + 1 }, (_, i) => {
      const day = new Date(sprint.startDate.getTime() + i * 86400000);
      const completedByDay = sprint.issues
        .filter((issue) => issue.resolvedAt && issue.resolvedAt.getTime() <= day.getTime() + 86400000 - 1)
        .reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
      return {
        date: day.toISOString().slice(0, 10),
        remaining: Math.max(total - completedByDay, 0),
        ideal: Math.max(total - i * (total / days), 0)
      };
    });
  },

  async velocity(projectId: string) {
    const sprints = await prisma.sprint.findMany({
      where: { projectId, status: SprintStatus.COMPLETED },
      include: { sprintIssues: { include: { issue: true } } },
      orderBy: { completedAt: 'desc' },
      take: 6
    });
    return sprints.map((sprint) => ({
      sprintId: sprint.id,
      name: sprint.name,
      committed: sprint.sprintIssues.reduce((s, row) => s + (row.issue.storyPoints ?? 0), 0),
      completed: sprint.sprintIssues.filter((row) => row.completedInSprint).reduce((s, row) => s + (row.issue.storyPoints ?? 0), 0)
    })).reverse();
  }
};
