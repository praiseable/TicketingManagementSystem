import { prisma, PeriodType } from '@pm-platform/db';
import { stringify } from 'csv-stringify/sync';
import { performanceService } from '../services/performance.service.js';
import { asyncHandler, ok } from '../utils/apiResponse.js';

export const performanceController = {
  me: asyncHandler(async (req, res) => ok(res, await prisma.performanceSnapshot.findMany({ where: { userId: req.user!.id, ...(req.query.projectId ? { projectId: String(req.query.projectId) } : {}) }, orderBy: { createdAt: 'desc' }, take: 30 }))),
  team: asyncHandler(async (req, res) => ok(res, await prisma.performanceSnapshot.findMany({ where: { projectId: String(req.query.projectId) }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { periodKey: 'desc' } }))),
  timeReport: asyncHandler(async (req, res) => ok(res, await prisma.worklog.findMany({ where: { ...(req.query.userId ? { userId: String(req.query.userId) } : {}), ...(req.query.projectId ? { issue: { projectId: String(req.query.projectId) } } : {}) }, include: { issue: { select: { id: true, key: true, title: true, projectId: true } }, user: { select: { id: true, name: true, email: true } } }, orderBy: { dateStarted: 'desc' } }))),
  exportTime: asyncHandler(async (req, res) => { const rows = await prisma.worklog.findMany({ include: { issue: true, user: true } }); const csv = stringify(rows.map((r) => ({ user: r.user.email, issue: r.issue.key, seconds: r.timeSpent, date: r.dateStarted.toISOString() })), { header: true }); res.header('Content-Type', 'text/csv'); res.attachment('time-report.csv'); res.send(csv); }),
  aggregate: asyncHandler(async (req, res) => ok(res, await performanceService.aggregateUserPerformance(req.user!.id, String(req.query.projectId), PeriodType.DAILY, new Date().toISOString().slice(0, 10))))
};
