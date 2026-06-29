import { prisma } from '@pm-platform/db';
import { asyncHandler, noContent, ok } from '../utils/apiResponse.js';

export const backlogsController = {
  list: asyncHandler(async (req, res) => ok(res, await prisma.issue.findMany({ where: { projectId: req.params.projectId, sprintId: null }, include: { issueType: true, workflowStatus: true, assignee: { select: { id: true, name: true, email: true } } }, orderBy: { position: 'asc' } }))),
  reorder: asyncHandler(async (req, res) => { await prisma.issue.update({ where: { id: req.body.issueId }, data: { position: req.body.newPosition } }); noContent(res); }),
  moveToSprint: asyncHandler(async (req, res) => { await prisma.issue.updateMany({ where: { id: { in: req.body.issueIds }, projectId: req.params.projectId }, data: { sprintId: req.body.sprintId } }); noContent(res); })
};
