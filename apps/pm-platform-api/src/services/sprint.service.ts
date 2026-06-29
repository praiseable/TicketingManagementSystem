import { prisma, SprintStatus } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';

export const sprintService = {
  async create(projectId: string, input: any) {
    return prisma.sprint.create({ data: { projectId, name: input.name, goal: input.goal, startDate: new Date(input.startDate), endDate: new Date(input.endDate) } });
  },
  async start(projectId: string, sprintId: string) {
    const active = await prisma.sprint.findFirst({ where: { projectId, status: SprintStatus.ACTIVE, NOT: { id: sprintId } } });
    if (active) throw new AppError(409, 'ACTIVE_SPRINT_EXISTS', 'Only one sprint can be active per project');
    const sprint = await prisma.sprint.update({ where: { id: sprintId }, data: { status: SprintStatus.ACTIVE } });
    return sprint;
  },
  async complete(projectId: string, sprintId: string, moveToSprintId?: string | null) {
    const incomplete = await prisma.issue.findMany({ where: { projectId, sprintId, workflowStatus: { category: { not: 'DONE' } } } });
    await prisma.$transaction([
      prisma.issue.updateMany({ where: { id: { in: incomplete.map((i) => i.id) } }, data: { sprintId: moveToSprintId ?? null } }),
      prisma.sprint.update({ where: { id: sprintId }, data: { status: SprintStatus.COMPLETED, completedAt: new Date() } }),
      prisma.sprintIssue.updateMany({ where: { sprintId }, data: { completedInSprint: false } })
    ]);
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    return { sprint, movedIssues: incomplete.length };
  },
  async burndown(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, include: { issues: true } });
    if (!sprint) throw new AppError(404, 'SPRINT_NOT_FOUND', 'Sprint not found');
    const total = sprint.issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    const days = Math.max(Math.ceil((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86400000), 1);
    return Array.from({ length: days + 1 }, (_, i) => ({ date: new Date(sprint.startDate.getTime() + i * 86400000).toISOString().slice(0, 10), remaining: Math.max(total - i * (total / days), 0), ideal: Math.max(total - i * (total / days), 0) }));
  },
  async velocity(projectId: string) {
    const sprints = await prisma.sprint.findMany({ where: { projectId, status: SprintStatus.COMPLETED }, include: { issues: true }, orderBy: { completedAt: 'desc' }, take: 6 });
    return sprints.map((sprint) => ({ sprintId: sprint.id, name: sprint.name, committed: sprint.issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0), completed: sprint.issues.filter((i) => i.resolvedAt).reduce((s, i) => s + (i.storyPoints ?? 0), 0) }));
  }
};
