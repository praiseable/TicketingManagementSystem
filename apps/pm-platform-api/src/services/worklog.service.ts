import { prisma } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';

export const worklogService = {
  async create(issueId: string, userId: string, input: { timeSpent: number; dateStarted: string; description?: string | null }) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    return prisma.worklog.create({ data: { issueId, userId, timeSpent: input.timeSpent, dateStarted: new Date(input.dateStarted), description: input.description } });
  },
  async update(worklogId: string, userId: string, isAdmin: boolean, input: any) {
    const worklog = await prisma.worklog.findUnique({ where: { id: worklogId } });
    if (!worklog) throw new AppError(404, 'WORKLOG_NOT_FOUND', 'Worklog not found');
    if (!isAdmin && worklog.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Can only edit own worklog');
    return prisma.worklog.update({ where: { id: worklogId }, data: { ...input, dateStarted: input.dateStarted ? new Date(input.dateStarted) : undefined } });
  },
  async delete(worklogId: string, userId: string, isAdmin: boolean) {
    const worklog = await prisma.worklog.findUnique({ where: { id: worklogId } });
    if (!worklog) return;
    if (!isAdmin && worklog.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Can only delete own worklog');
    await prisma.worklog.delete({ where: { id: worklogId } });
  }
};
