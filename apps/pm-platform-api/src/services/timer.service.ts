import { prisma } from '@pm-platform/db';
import { redis } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { emitToUser, emitToProject } from '../sockets/index.js';

function key(userId: string, issueId: string) {
  return `timer:${userId}:${issueId}`;
}

type TimerPayload = {
  issueId: string;
  userId: string;
  startedAt: string;
  accumulatedSeconds: number;
  status: 'ACTIVE' | 'PAUSED';
  issue?: { id: string; key: string; title: string; projectId: string };
};

const issueSelect = { id: true, key: true, title: true, projectId: true, originalEstimate: true, remainingEstimate: true };
const userSummary = { select: { id: true, email: true, name: true, avatarUrl: true, role: true } };
const worklogInclude = { user: userSummary, issue: { select: issueSelect } };

async function read(userId: string, issueId: string) {
  const raw = await redis.get(key(userId, issueId));
  return raw ? (JSON.parse(raw) as TimerPayload) : null;
}

function elapsedSeconds(timer: TimerPayload) {
  const activeDelta = timer.status === 'ACTIVE' ? Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000) : 0;
  return Math.max(timer.accumulatedSeconds + activeDelta, 0);
}

async function getIssue(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: issueSelect });
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

function toClient(timer: TimerPayload) {
  return { ...timer, elapsedSeconds: elapsedSeconds(timer) };
}

export const timerService = {
  async startTimer(userId: string, issueId: string) {
    const issue = await getIssue(issueId);
    const existing = await read(userId, issueId);

    if (existing?.status === 'ACTIVE') throw new AppError(409, 'TIMER_ALREADY_ACTIVE', 'Timer already active for this issue');

    const now = new Date();
    const payload: TimerPayload = existing
      ? { ...existing, startedAt: now.toISOString(), status: 'ACTIVE', issue }
      : { issueId, userId, startedAt: now.toISOString(), accumulatedSeconds: 0, status: 'ACTIVE', issue };

    await redis.set(key(userId, issueId), JSON.stringify(payload));
    await prisma.timerSession.upsert({
      where: { issueId_userId: { issueId, userId } },
      update: { startedAt: now, accumulatedSeconds: payload.accumulatedSeconds, status: 'ACTIVE' },
      create: { issueId, userId, startedAt: now, accumulatedSeconds: payload.accumulatedSeconds, status: 'ACTIVE' }
    });

    await prisma.issueHistory.create({ data: { issueId, userId, field: existing ? 'timer.resumed' : 'timer.started', oldValue: null, newValue: JSON.stringify({ at: now.toISOString(), accumulatedSeconds: payload.accumulatedSeconds }) } });
    emitToUser(userId, 'timer:tick', toClient(payload));
    emitToProject(issue.projectId, 'issue:updated', { id: issueId, projectId: issue.projectId, timerChanged: true });
    return toClient(payload);
  },

  async pauseTimer(userId: string, issueId: string) {
    const issue = await getIssue(issueId);
    const timer = await read(userId, issueId);
    if (!timer) throw new AppError(404, 'TIMER_NOT_FOUND', 'Timer not found');
    if (timer.status === 'PAUSED') return toClient({ ...timer, issue });

    const accumulatedSeconds = elapsedSeconds(timer);
    const updated: TimerPayload = { ...timer, issue, accumulatedSeconds, status: 'PAUSED', startedAt: new Date().toISOString() };
    await redis.set(key(userId, issueId), JSON.stringify(updated));
    await prisma.timerSession.update({ where: { issueId_userId: { issueId, userId } }, data: { accumulatedSeconds, status: 'PAUSED' } });
    await prisma.issueHistory.create({ data: { issueId, userId, field: 'timer.paused', oldValue: null, newValue: JSON.stringify({ accumulatedSeconds }) } });
    emitToUser(userId, 'timer:tick', toClient(updated));
    emitToProject(issue.projectId, 'issue:updated', { id: issueId, projectId: issue.projectId, timerChanged: true });
    return toClient(updated);
  },

  async stopTimer(userId: string, issueId: string, description?: string | null) {
    const issue = await getIssue(issueId);
    const timer = await read(userId, issueId);
    if (!timer) throw new AppError(404, 'TIMER_NOT_FOUND', 'Timer not found');
    const seconds = Math.max(elapsedSeconds(timer), 1);
    const beforeRemaining = issue.remainingEstimate;

    const worklog = await prisma.$transaction(async (tx) => {
      const created = await tx.worklog.create({
        data: {
          issueId,
          userId,
          timeSpent: seconds,
          dateStarted: new Date(timer.startedAt),
          description: description ?? 'Saved from live timer'
        },
        include: worklogInclude
      });
      await tx.issueHistory.create({ data: { issueId, userId, field: 'timer.stopped', oldValue: JSON.stringify({ accumulatedSeconds: timer.accumulatedSeconds, status: timer.status }), newValue: JSON.stringify({ timeSpent: seconds }) } });
      await tx.issueHistory.create({ data: { issueId, userId, field: 'worklog.added', oldValue: null, newValue: JSON.stringify({ timeSpent: seconds, description: created.description }) } });
      const estimate = await recalcRemainingEstimate(tx, issueId);
      if (estimate) {
        await tx.issueHistory.create({ data: { issueId, userId, field: 'remainingEstimate', oldValue: beforeRemaining == null ? null : String(beforeRemaining), newValue: String(estimate.remainingEstimate) } });
      }
      return created;
    });

    await redis.del(key(userId, issueId));
    await prisma.timerSession.deleteMany({ where: { issueId, userId } });
    emitToUser(userId, 'timer:stopped', { issueId, worklog });
    emitToProject(issue.projectId, 'issue:updated', { id: issueId, projectId: issue.projectId, worklogChanged: true, timerChanged: true });
    return worklog;
  },

  async getActiveTimers(userId: string) {
    const stream = redis.scanStream({ match: `timer:${userId}:*`, count: 50 });
    const timers: TimerPayload[] = [];
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length) {
        const values = await redis.mget(keys);
        timers.push(...values.filter(Boolean).map((value) => JSON.parse(value as string)));
      }
    }
    const issueIds = [...new Set(timers.map((timer) => timer.issueId))];
    const issues = issueIds.length ? await prisma.issue.findMany({ where: { id: { in: issueIds } }, select: issueSelect }) : [];
    const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
    return timers.map((timer) => toClient({ ...timer, issue: issueMap.get(timer.issueId) ?? timer.issue }));
  }
};

export async function emitTimerTicks() {
  const stream = redis.scanStream({ match: 'timer:*', count: 100 });
  for await (const keys of stream as AsyncIterable<string[]>) {
    if (!keys.length) continue;
    const values = await redis.mget(keys);
    for (const value of values) {
      if (!value) continue;
      const timer = JSON.parse(value) as TimerPayload;
      emitToUser(timer.userId, 'timer:tick', toClient(timer));
    }
  }
}
