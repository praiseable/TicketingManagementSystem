import { prisma, PeriodType } from '@pm-platform/db';

type QueryLike = Record<string, unknown>;
type UserContext = { id: string; orgId: string; email: string; role: string; name: string };

type DateRange = {
  period: string;
  periodType: PeriodType;
  periodKey: string;
  from: Date;
  to: Date;
};

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) value = value[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeRange(query: QueryLike): DateRange {
  const now = new Date();
  const period = (firstString(query.period) ?? 'month').toLowerCase();
  const fromRaw = firstString(query.from);
  const toRaw = firstString(query.to);

  let from: Date;
  let to: Date;
  let periodType: PeriodType = PeriodType.MONTHLY;

  if (fromRaw || toRaw || period === 'custom') {
    from = fromRaw ? startOfDay(new Date(fromRaw)) : startOfDay(addDays(now, -30));
    to = toRaw ? endOfDay(new Date(toRaw)) : endOfDay(now);
    periodType = PeriodType.DAILY;
  } else if (period === 'week' || period === 'weekly') {
    from = startOfDay(addDays(now, -6));
    to = endOfDay(now);
    periodType = PeriodType.WEEKLY;
  } else if (period === 'quarter' || period === 'quarterly') {
    const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    from = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1, 0, 0, 0, 0));
    to = endOfDay(now);
    periodType = PeriodType.QUARTERLY;
  } else {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    to = endOfDay(now);
    periodType = PeriodType.MONTHLY;
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    from = startOfDay(addDays(now, -30));
    to = endOfDay(now);
  }

  return { period, periodType, periodKey: `${dateKey(from)}:${dateKey(to)}`, from, to };
}

function rangeWhere(range: DateRange) {
  return { gte: range.from, lte: range.to };
}

async function projectIdsForUser(user: UserContext, projectId?: string) {
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId, isArchived: false }, select: { id: true } });
    return project ? [project.id] : [];
  }

  const memberships = await prisma.projectMember.findMany({ where: { userId: user.id, project: { orgId: user.orgId, isArchived: false } }, select: { projectId: true } });
  if (memberships.length) return memberships.map((m) => m.projectId);

  const projects = await prisma.project.findMany({ where: { orgId: user.orgId, isArchived: false }, select: { id: true } });
  return projects.map((p) => p.id);
}

async function summarizeUser(userId: string, projectIds: string[], range: DateRange) {
  const issueScope = { projectId: { in: projectIds } } as const;
  const worklogScope = { userId, dateStarted: rangeWhere(range), issue: issueScope };

  const [assignedIssues, completedIssues, createdCount, worklogs, bugCount] = await Promise.all([
    prisma.issue.findMany({ where: { ...issueScope, assigneeId: userId }, include: { workflowStatus: true } }),
    prisma.issue.findMany({
      where: {
        ...issueScope,
        assigneeId: userId,
        workflowStatus: { category: 'DONE' },
        OR: [{ resolvedAt: rangeWhere(range) }, { resolvedAt: null, updatedAt: rangeWhere(range) }]
      },
      include: { workflowStatus: true }
    }),
    prisma.issue.count({ where: { ...issueScope, reporterId: userId, createdAt: rangeWhere(range) } }),
    prisma.worklog.findMany({ where: worklogScope, include: { issue: { include: { project: true, issueType: true } }, user: { select: { id: true, email: true, name: true, avatarUrl: true } } }, orderBy: { dateStarted: 'desc' } }),
    prisma.issue.count({ where: { ...issueScope, assigneeId: userId, issueType: { name: { equals: 'Bug', mode: 'insensitive' } } } })
  ]);

  const issuesAssigned = assignedIssues.length;
  const issuesCompleted = completedIssues.length;
  const timeLoggedSeconds = worklogs.reduce((sum, row) => sum + row.timeSpent, 0);
  const storyPointsDelivered = completedIssues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
  const completedOnTime = completedIssues.filter((issue) => !issue.dueDate || (issue.resolvedAt && issue.resolvedAt <= issue.dueDate)).length;
  const onTimePct = issuesCompleted ? Math.round((completedOnTime / issuesCompleted) * 10000) / 100 : 0;
  const estimatedSeconds = completedIssues.reduce((sum, issue) => sum + (issue.originalEstimate ?? 0), 0);
  const estimateAccuracyPct = estimatedSeconds
    ? Math.max(0, Math.round((100 - Math.min(Math.abs(timeLoggedSeconds - estimatedSeconds) / estimatedSeconds, 1) * 100) * 100) / 100)
    : null;
  const avgResolutionSeconds = issuesCompleted
    ? Math.round(completedIssues.reduce((sum, issue) => sum + (((issue.resolvedAt ?? issue.updatedAt).getTime() - issue.createdAt.getTime()) / 1000), 0) / issuesCompleted)
    : null;
  const bugRate = issuesAssigned ? Math.round((bugCount / issuesAssigned) * 10000) / 100 : 0;

  const dailyMap = new Map<string, number>();
  for (let day = startOfDay(range.from); day <= range.to; day = addDays(day, 1)) dailyMap.set(dateKey(day), 0);
  for (const log of worklogs) {
    const key = dateKey(log.dateStarted);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + log.timeSpent);
  }

  const dailyTime = Array.from(dailyMap.entries()).map(([date, seconds]) => ({
    date,
    seconds,
    hours: Math.round((seconds / 3600) * 100) / 100
  }));

  return {
    summary: {
      issuesAssigned,
      issuesCompleted,
      issuesCreated: createdCount,
      timeLoggedSeconds,
      hoursLogged: Math.round((timeLoggedSeconds / 3600) * 100) / 100,
      onTimePct,
      storyPointsDelivered,
      estimateAccuracyPct,
      avgResolutionSeconds,
      bugRate,
      worklogCount: worklogs.length
    },
    dailyTime,
    worklogs
  };
}

async function recentActivity(userId: string, projectIds: string[], range: DateRange) {
  const [histories, worklogs, comments] = await Promise.all([
    prisma.issueHistory.findMany({
      where: { userId, createdAt: rangeWhere(range), issue: { projectId: { in: projectIds } } },
      include: { issue: { select: { id: true, key: true, title: true, projectId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.worklog.findMany({
      where: { userId, dateStarted: rangeWhere(range), issue: { projectId: { in: projectIds } } },
      include: { issue: { select: { id: true, key: true, title: true, projectId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.comment.findMany({
      where: { userId, createdAt: rangeWhere(range), issue: { projectId: { in: projectIds } } },
      include: { issue: { select: { id: true, key: true, title: true, projectId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  return [
    ...histories.map((row) => ({ type: 'history', action: row.field, issue: row.issue, at: row.createdAt.toISOString(), detail: row.newValue })),
    ...worklogs.map((row) => ({ type: 'worklog', action: 'logged work', issue: row.issue, at: row.createdAt.toISOString(), seconds: row.timeSpent, detail: row.description })),
    ...comments.map((row) => ({ type: 'comment', action: 'commented', issue: row.issue, at: row.createdAt.toISOString(), detail: row.body.slice(0, 160) }))
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
}

function periodEnumFromRange(range: DateRange) {
  return range.periodType;
}

async function upsertSnapshot(userId: string, projectId: string | null, range: DateRange, summary: any) {
  if (!projectId) return null;
  return prisma.performanceSnapshot.upsert({
    where: { userId_projectId_periodType_periodKey: { userId, projectId, periodType: periodEnumFromRange(range), periodKey: range.periodKey } },
    update: {
      issuesAssigned: summary.issuesAssigned,
      issuesCompleted: summary.issuesCompleted,
      issuesCreated: summary.issuesCreated,
      timeLoggedSeconds: summary.timeLoggedSeconds,
      onTimePct: summary.onTimePct,
      storyPointsDelivered: summary.storyPointsDelivered,
      estimateAccuracyPct: summary.estimateAccuracyPct,
      avgResolutionSeconds: summary.avgResolutionSeconds,
      bugRate: summary.bugRate
    },
    create: {
      userId,
      projectId,
      periodType: periodEnumFromRange(range),
      periodKey: range.periodKey,
      issuesAssigned: summary.issuesAssigned,
      issuesCompleted: summary.issuesCompleted,
      issuesCreated: summary.issuesCreated,
      timeLoggedSeconds: summary.timeLoggedSeconds,
      onTimePct: summary.onTimePct,
      storyPointsDelivered: summary.storyPointsDelivered,
      estimateAccuracyPct: summary.estimateAccuracyPct,
      avgResolutionSeconds: summary.avgResolutionSeconds,
      bugRate: summary.bugRate
    }
  });
}

function normalizeGroupBy(value: unknown) {
  const groupBy = firstString(value) ?? 'user';
  return ['user', 'project', 'issue', 'issueType', 'day'].includes(groupBy) ? groupBy : 'user';
}

export const performanceService = {
  async getMyPerformance(user: UserContext, query: QueryLike) {
    const range = normalizeRange(query);
    const projectId = firstString(query.projectId);
    const projectIds = await projectIdsForUser(user, projectId);
    const metrics = await summarizeUser(user.id, projectIds, range);
    const activity = await recentActivity(user.id, projectIds, range);
    const snapshot = await upsertSnapshot(user.id, projectId ?? projectIds[0] ?? null, range, metrics.summary);
    const snapshots = await prisma.performanceSnapshot.findMany({
      where: { userId: user.id, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 12
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      range: { period: range.period, periodType: range.periodType, periodKey: range.periodKey, from: range.from.toISOString(), to: range.to.toISOString() },
      projectIds,
      summary: metrics.summary,
      dailyTime: metrics.dailyTime,
      recentActivity: activity,
      snapshot,
      snapshots
    };
  },

  async getTeamPerformance(user: UserContext, query: QueryLike) {
    const range = normalizeRange(query);
    let projectId = firstString(query.projectId);
    if (!projectId) {
      const firstProject = await prisma.project.findFirst({ where: { orgId: user.orgId, isArchived: false }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      projectId = firstProject?.id;
    }
    if (!projectId) return { range, project: null, rows: [], totals: { members: 0, issuesCompleted: 0, timeLoggedSeconds: 0, storyPointsDelivered: 0 } };

    const project = await prisma.project.findFirst({ where: { id: projectId, orgId: user.orgId }, select: { id: true, key: true, name: true } });
    if (!project) return { range, project: null, rows: [], totals: { members: 0, issuesCompleted: 0, timeLoggedSeconds: 0, storyPointsDelivered: 0 } };

    const members = await prisma.projectMember.findMany({ where: { projectId }, include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, role: true } } }, orderBy: { createdAt: 'asc' } });
    const rows = [];
    for (const member of members.filter((m) => m.user.isActive)) {
      const metrics = await summarizeUser(member.userId, [projectId], range);
      await upsertSnapshot(member.userId, projectId, range, metrics.summary);
      rows.push({ user: member.user, projectRole: member.role, summary: metrics.summary, dailyTime: metrics.dailyTime });
    }

    const totals = rows.reduce((acc, row) => {
      acc.members += 1;
      acc.issuesAssigned += row.summary.issuesAssigned;
      acc.issuesCompleted += row.summary.issuesCompleted;
      acc.timeLoggedSeconds += row.summary.timeLoggedSeconds;
      acc.storyPointsDelivered += row.summary.storyPointsDelivered;
      return acc;
    }, { members: 0, issuesAssigned: 0, issuesCompleted: 0, timeLoggedSeconds: 0, storyPointsDelivered: 0 });

    return {
      project,
      range: { period: range.period, periodType: range.periodType, periodKey: range.periodKey, from: range.from.toISOString(), to: range.to.toISOString() },
      rows,
      totals: { ...totals, hoursLogged: Math.round((totals.timeLoggedSeconds / 3600) * 100) / 100 }
    };
  },

  async getTimeReport(user: UserContext, query: QueryLike) {
    const range = normalizeRange(query);
    const projectId = firstString(query.projectId);
    const userId = firstString(query.userId);
    const groupBy = normalizeGroupBy(query.groupBy);
    const projectIds = await projectIdsForUser(user, projectId);

    const where: any = { dateStarted: rangeWhere(range), issue: { projectId: { in: projectIds } } };
    if (userId) where.userId = userId;

    const worklogs = await prisma.worklog.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
        issue: { include: { project: { select: { id: true, key: true, name: true } }, issueType: { select: { id: true, name: true } } } }
      },
      orderBy: { dateStarted: 'desc' }
    });

    const rows = worklogs.map((row) => ({
      id: row.id,
      user: row.user,
      project: row.issue.project,
      issue: { id: row.issue.id, key: row.issue.key, title: row.issue.title },
      issueType: row.issue.issueType,
      timeSpent: row.timeSpent,
      hours: Math.round((row.timeSpent / 3600) * 100) / 100,
      dateStarted: row.dateStarted.toISOString(),
      description: row.description
    }));

    const grouped = new Map<string, { key: string; label: string; timeSpent: number; hours: number; worklogCount: number }>();
    for (const row of rows) {
      let key = row.user.id;
      let label = row.user.name || row.user.email;
      if (groupBy === 'project') { key = row.project.id; label = `${row.project.key} · ${row.project.name}`; }
      if (groupBy === 'issue') { key = row.issue.id; label = `${row.issue.key} · ${row.issue.title}`; }
      if (groupBy === 'issueType') { key = row.issueType.id; label = row.issueType.name; }
      if (groupBy === 'day') { key = row.dateStarted.slice(0, 10); label = key; }
      const current = grouped.get(key) ?? { key, label, timeSpent: 0, hours: 0, worklogCount: 0 };
      current.timeSpent += row.timeSpent;
      current.hours = Math.round((current.timeSpent / 3600) * 100) / 100;
      current.worklogCount += 1;
      grouped.set(key, current);
    }

    const totalSeconds = rows.reduce((sum, row) => sum + row.timeSpent, 0);

    return {
      range: { period: range.period, periodType: range.periodType, periodKey: range.periodKey, from: range.from.toISOString(), to: range.to.toISOString() },
      filters: { projectId: projectId ?? null, userId: userId ?? null, groupBy },
      summary: { worklogCount: rows.length, timeLoggedSeconds: totalSeconds, hoursLogged: Math.round((totalSeconds / 3600) * 100) / 100 },
      grouped: Array.from(grouped.values()).sort((a, b) => b.timeSpent - a.timeSpent),
      rows
    };
  },

  async timeReportCsv(user: UserContext, query: QueryLike, stringify: (rows: any[], options: any) => string) {
    const report = await this.getTimeReport(user, query);
    const csv = stringify(report.rows.map((row) => ({
      user: row.user.email,
      project: row.project.key,
      issue: row.issue.key,
      issueTitle: row.issue.title,
      issueType: row.issueType.name,
      seconds: row.timeSpent,
      hours: row.hours,
      dateStarted: row.dateStarted,
      description: row.description ?? ''
    })), { header: true });
    return { report, csv };
  },

  async aggregateUserPerformance(userId: string, projectId: string, periodType: PeriodType, periodKey: string) {
    const [fromRaw, toRaw] = periodKey.includes(':') ? periodKey.split(':') : [new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)];
    const range = normalizeRange({ from: fromRaw, to: toRaw, period: periodType.toLowerCase() });
    const fakeUser = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, orgId: true, email: true, name: true, role: true } });
    const metrics = await summarizeUser(userId, [projectId], range);
    return upsertSnapshot(fakeUser.id, projectId, { ...range, periodType, periodKey }, metrics.summary);
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
