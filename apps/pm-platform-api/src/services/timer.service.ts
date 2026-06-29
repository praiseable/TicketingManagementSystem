import { prisma } from '@pm-platform/db';
import { redis } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { emitToUser } from '../sockets/index.js';

function key(userId: string, issueId: string) {
  return `timer:${userId}:${issueId}`;
}

type TimerPayload = { issueId: string; userId: string; startedAt: string; accumulatedSeconds: number; status: 'ACTIVE' | 'PAUSED' };

async function read(userId: string, issueId: string) {
  const raw = await redis.get(key(userId, issueId));
  return raw ? (JSON.parse(raw) as TimerPayload) : null;
}

function elapsedSeconds(timer: TimerPayload) {
  const activeDelta = timer.status === 'ACTIVE' ? Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000) : 0;
  return timer.accumulatedSeconds + activeDelta;
}

export const timerService = {
  async startTimer(userId: string, issueId: string) {
    if (await read(userId, issueId)) throw new AppError(409, 'TIMER_ALREADY_ACTIVE', 'Timer already active for this issue');
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const payload: TimerPayload = { issueId, userId, startedAt: new Date().toISOString(), accumulatedSeconds: 0, status: 'ACTIVE' };
    await redis.set(key(userId, issueId), JSON.stringify(payload));
    await prisma.timerSession.upsert({ where: { issueId_userId: { issueId, userId } }, update: { startedAt: new Date(payload.startedAt), accumulatedSeconds: 0, status: 'ACTIVE' }, create: { issueId, userId, startedAt: new Date(payload.startedAt), accumulatedSeconds: 0, status: 'ACTIVE' } });
    emitToUser(userId, 'timer:tick', { ...payload, elapsedSeconds: 0 });
    return payload;
  },

  async pauseTimer(userId: string, issueId: string) {
    const timer = await read(userId, issueId);
    if (!timer) throw new AppError(404, 'TIMER_NOT_FOUND', 'Timer not found');
    const updated: TimerPayload = { ...timer, accumulatedSeconds: elapsedSeconds(timer), status: 'PAUSED', startedAt: new Date().toISOString() };
    await redis.set(key(userId, issueId), JSON.stringify(updated));
    await prisma.timerSession.update({ where: { issueId_userId: { issueId, userId } }, data: { accumulatedSeconds: updated.accumulatedSeconds, status: 'PAUSED' } });
    emitToUser(userId, 'timer:tick', { ...updated, elapsedSeconds: updated.accumulatedSeconds });
    return updated;
  },

  async stopTimer(userId: string, issueId: string) {
    const timer = await read(userId, issueId);
    if (!timer) throw new AppError(404, 'TIMER_NOT_FOUND', 'Timer not found');
    const seconds = Math.max(elapsedSeconds(timer), 1);
    const worklog = await prisma.worklog.create({ data: { issueId, userId, timeSpent: seconds, dateStarted: new Date(timer.startedAt), description: 'Saved from live timer' } });
    await redis.del(key(userId, issueId));
    await prisma.timerSession.deleteMany({ where: { issueId, userId } });
    emitToUser(userId, 'timer:stopped', { issueId, worklog });
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
    return timers.map((timer) => ({ ...timer, elapsedSeconds: elapsedSeconds(timer) }));
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
      emitToUser(timer.userId, 'timer:tick', { ...timer, elapsedSeconds: elapsedSeconds(timer) });
    }
  }
}
