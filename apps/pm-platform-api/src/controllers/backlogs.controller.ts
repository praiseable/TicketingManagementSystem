import { prisma } from '@pm-platform/db';
import { sprintService } from '../services/sprint.service.js';
import { asyncHandler, noContent, ok } from '../utils/apiResponse.js';
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

export const backlogsController = {
  list: asyncHandler(async (req, res) => {
    const issues = await prisma.issue.findMany({
      where: { projectId: String(req.params.projectId), sprintId: null, parentId: null },
      include: issueInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });
    ok(res, issues);
  }),

  reorder: asyncHandler(async (req, res) => {
    const issue = await prisma.issue.findFirst({ where: { id: req.body.issueId, projectId: String(req.params.projectId) } });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found in project');
    await prisma.issue.update({ where: { id: req.body.issueId }, data: { position: req.body.newPosition } });
    noContent(res);
  }),

  moveToSprint: asyncHandler(async (req, res) => {
    await sprintService.addIssues(String(req.params.projectId), req.body.sprintId ?? null, req.body.issueIds, req.user?.id);
    noContent(res);
  })
};
