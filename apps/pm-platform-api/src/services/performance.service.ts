import { prisma, PeriodType } from '@pm-platform/db';

export const performanceService = {
  async aggregateUserPerformance(userId: string, projectId: string, periodType: PeriodType, periodKey: string) {
    const [assigned, completed, created, worklogs, bugs] = await Promise.all([
      prisma.issue.count({ where: { projectId, assigneeId: userId } }),
      prisma.issue.findMany({ where: { projectId, assigneeId: userId, workflowStatus: { category: 'DONE' } } }),
      prisma.issue.count({ where: { projectId, reporterId: userId } }),
      prisma.worklog.findMany({ where: { userId, issue: { projectId } } }),
      prisma.issue.count({ where: { projectId, issueType: { name: { equals: 'Bug', mode: 'insensitive' } } } })
    ]);
    const completedCount = completed.length;
    const timeLoggedSeconds = worklogs.reduce((sum, log) => sum + log.timeSpent, 0);
    const storyPointsDelivered = completed.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    const onTimePct = completedCount === 0 ? 0 : (completed.filter((issue) => !issue.dueDate || (issue.resolvedAt && issue.resolvedAt <= issue.dueDate)).length / completedCount) * 100;
    const estimated = completed.reduce((sum, issue) => sum + (issue.originalEstimate ?? 0), 0);
    const estimateAccuracyPct = estimated ? Math.min((estimated / Math.max(timeLoggedSeconds, 1)) * 100, 200) : null;
    const avgResolutionSeconds = completedCount ? completed.reduce((sum, issue) => sum + ((issue.resolvedAt?.getTime() ?? Date.now()) - issue.createdAt.getTime()) / 1000, 0) / completedCount : null;
    return prisma.performanceSnapshot.upsert({
      where: { userId_projectId_periodType_periodKey: { userId, projectId, periodType, periodKey } },
      update: { issuesAssigned: assigned, issuesCompleted: completedCount, issuesCreated: created, timeLoggedSeconds, onTimePct, storyPointsDelivered, estimateAccuracyPct, avgResolutionSeconds, bugRate: assigned ? bugs / assigned : 0 },
      create: { userId, projectId, periodType, periodKey, issuesAssigned: assigned, issuesCompleted: completedCount, issuesCreated: created, timeLoggedSeconds, onTimePct, storyPointsDelivered, estimateAccuracyPct, avgResolutionSeconds, bugRate: assigned ? bugs / assigned : 0 }
    });
  },

  async aggregateAllUsers(periodType: PeriodType, periodKey: string) {
    const memberships = await prisma.projectMember.findMany({ include: { user: true } });
    const snapshots = [];
    for (const member of memberships) {
      if (member.user.isActive) snapshots.push(await this.aggregateUserPerformance(member.userId, member.projectId, periodType, periodKey));
    }
    return snapshots;
  }
};
