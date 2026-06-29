import { prisma, NotificationType, StatusCategory } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { pagination, meta } from '../utils/paginate.js';
import { emitToProject } from '../sockets/index.js';
import { notificationService } from './notification.service.js';
import { webhookService } from './webhook.service.js';
import { workflowService } from './workflow.service.js';

const userSummary = { select: { id: true, email: true, name: true, avatarUrl: true, role: true } };
const issueSummary = {
  select: {
    id: true,
    key: true,
    title: true,
    priority: true,
    workflowStatus: true,
    issueType: true,
    assignee: userSummary
  }
};

const issueInclude = {
  issueType: true,
  workflowStatus: true,
  reporter: userSummary,
  assignee: userSummary,
  labels: { include: { label: true } },
  customFieldValues: { include: { customField: true } },
  _count: { select: { comments: true, attachments: true, watchers: true, children: true } }
};

const detailInclude = {
  ...issueInclude,
  parent: issueSummary,
  children: { ...issueSummary, orderBy: [{ createdAt: 'asc' as const }] },
  comments: {
    where: { parentId: null },
    include: {
      user: userSummary,
      replies: { include: { user: userSummary }, orderBy: { createdAt: 'asc' as const } }
    },
    orderBy: { createdAt: 'asc' as const }
  },
  attachments: { include: { user: userSummary }, orderBy: { createdAt: 'desc' as const } },
  histories: { include: { user: userSummary }, orderBy: { createdAt: 'desc' as const } },
  worklogs: { include: { user: userSummary }, orderBy: { dateStarted: 'desc' as const } },
  watchers: { include: { user: userSummary }, orderBy: { createdAt: 'asc' as const } },
  sourceLinks: { include: { targetIssue: issueSummary, createdBy: userSummary }, orderBy: { createdAt: 'desc' as const } },
  targetLinks: { include: { sourceIssue: issueSummary, createdBy: userSummary }, orderBy: { createdAt: 'desc' as const } }
};

function splitLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((label) => String(label).trim()).filter(Boolean))];
}

async function replaceLabels(tx: any, projectId: string, issueId: string, labels: string[]) {
  await tx.issueLabel.deleteMany({ where: { issueId } });
  for (const name of labels) {
    const label = await tx.label.upsert({
      where: { projectId_name: { projectId, name } },
      update: {},
      create: { projectId, name, color: '#64748b' }
    });
    await tx.issueLabel.upsert({
      where: { issueId_labelId: { issueId, labelId: label.id } },
      update: {},
      create: { issueId, labelId: label.id }
    });
  }
}

function normalizeData(input: any) {
  const data: any = { ...input };
  delete data.customFields;
  delete data.labels;
  if ('dueDate' in data) data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if ('description' in data && data.description === undefined) delete data.description;
  return data;
}

export const issueService = {
  async list(projectId: string, query: Record<string, unknown>) {
    const { page, limit, skip, take } = pagination(query);
    const where: any = { projectId };
    if (query.status) where.workflowStatusId = String(query.status);
    if (query.type) where.issueTypeId = String(query.type);
    if (query.assignee) where.assigneeId = String(query.assignee);
    if (query.priority) where.priority = String(query.priority);
    if (query.sprint) where.sprintId = String(query.sprint);
    if (query.parentId === 'null') where.parentId = null;
    else if (query.parentId) where.parentId = String(query.parentId);
    if (query.label) where.labels = { some: { label: { name: String(query.label) } } };
    if (query.search) {
      const search = String(query.search);
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } }
      ];
    }
    const [data, total] = await prisma.$transaction([
      prisma.issue.findMany({ where, skip, take, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }], include: issueInclude }),
      prisma.issue.count({ where })
    ]);
    return { data, meta: meta(page, limit, total) };
  },

  async create(projectId: string, userId: string, input: any) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    const issueType = input.issueTypeId
      ? await prisma.issueType.findFirst({ where: { id: input.issueTypeId, projectId } })
      : await prisma.issueType.findFirst({ where: { projectId }, orderBy: { position: 'asc' } });
    const workflow = await prisma.workflow.findFirst({ where: { projectId, isDefault: true }, include: { statuses: { orderBy: { position: 'asc' } } } });
    const statusId = input.workflowStatusId ?? workflow?.statuses[0]?.id;
    if (!issueType || !statusId) throw new AppError(422, 'PROJECT_NOT_CONFIGURED', 'Project needs issue type and workflow status');
    if (input.parentId) {
      const parent = await prisma.issue.findFirst({ where: { id: input.parentId, projectId } });
      if (!parent) throw new AppError(404, 'PARENT_ISSUE_NOT_FOUND', 'Parent issue not found');
    }
    const last = await prisma.issue.findFirst({ where: { projectId }, orderBy: { number: 'desc' } });
    const number = (last?.number ?? 0) + 1;
    const labels = splitLabels(input.labels);
    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.issue.create({
        data: {
          key: `${project.key}-${number}`,
          number,
          projectId,
          issueTypeId: issueType.id,
          workflowStatusId: statusId,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? 'MEDIUM',
          reporterId: userId,
          assigneeId: input.assigneeId ?? null,
          parentId: input.parentId ?? null,
          storyPoints: input.storyPoints ?? null,
          originalEstimate: input.originalEstimate ?? null,
          remainingEstimate: input.remainingEstimate ?? input.originalEstimate ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          position: Date.now()
        },
        include: issueInclude
      });
      await tx.issueHistory.create({ data: { issueId: created.id, userId, field: 'created', oldValue: null, newValue: created.key } });
      if (labels.length) await replaceLabels(tx, projectId, created.id, labels);
      if (input.customFields) {
        for (const [customFieldId, value] of Object.entries(input.customFields)) {
          await tx.customFieldValue.create({ data: { issueId: created.id, customFieldId, value: value == null ? null : String(value) } });
        }
      }
      return tx.issue.findUniqueOrThrow({ where: { id: created.id }, include: detailInclude });
    });
    emitToProject(projectId, 'issue:updated', issue);
    if (issue.assigneeId) await notificationService.notify(issue.assigneeId, NotificationType.ISSUE_ASSIGNED, `${issue.key} assigned`, issue.title, 'issue', issue.id);
    await webhookService.queueProjectEvent(projectId, 'issue.created', issue);
    return issue;
  },

  async get(projectId: string, issueId: string) {
    const issue = await prisma.issue.findFirst({ where: { id: issueId, projectId }, include: detailInclude });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    return issue;
  },

  async update(projectId: string, issueId: string, userId: string, input: any) {
    const current = await prisma.issue.findFirst({ where: { id: issueId, projectId }, include: { workflowStatus: true, labels: { include: { label: true } } } });
    if (!current) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const data = normalizeData(input);
    if (data.workflowStatusId) {
      const toStatus = await prisma.workflowStatus.findFirst({ where: { id: data.workflowStatusId, workflow: { projectId } } });
      if (!toStatus) throw new AppError(422, 'INVALID_STATUS', 'Workflow status does not belong to this project');
      data.resolvedAt = toStatus.category === StatusCategory.DONE ? new Date() : null;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const issue = await tx.issue.update({ where: { id: issueId }, data, include: issueInclude });
      for (const [field, value] of Object.entries(data)) {
        const oldValue = (current as any)[field];
        if (String(oldValue ?? '') !== String(value ?? '')) {
          await tx.issueHistory.create({ data: { issueId, userId, field, oldValue: oldValue == null ? null : String(oldValue), newValue: value == null ? null : String(value) } });
        }
      }
      if (Array.isArray(input.labels)) {
        const labels = splitLabels(input.labels);
        await replaceLabels(tx, projectId, issueId, labels);
        await tx.issueHistory.create({ data: { issueId, userId, field: 'labels', oldValue: current.labels.map((x) => x.label.name).join(', '), newValue: labels.join(', ') } });
      }
      if (input.customFields) {
        for (const [customFieldId, value] of Object.entries(input.customFields)) {
          await tx.customFieldValue.upsert({ where: { issueId_customFieldId: { issueId, customFieldId } }, update: { value: value == null ? null : String(value) }, create: { issueId, customFieldId, value: value == null ? null : String(value) } });
        }
      }
      return tx.issue.findUniqueOrThrow({ where: { id: issueId }, include: detailInclude });
    });
    emitToProject(projectId, 'issue:updated', updated);
    if (updated.assigneeId && updated.assigneeId !== current.assigneeId) await notificationService.notify(updated.assigneeId, NotificationType.ISSUE_ASSIGNED, `${updated.key} assigned`, updated.title, 'issue', updated.id);
    await webhookService.queueProjectEvent(projectId, 'issue.updated', updated);
    return updated;
  },

  async delete(projectId: string, issueId: string) {
    await prisma.issue.deleteMany({ where: { id: issueId, projectId } });
  },

  transition(issueId: string, toStatusId: string, userId: string, comment?: string) {
    return workflowService.executeTransition(issueId, toStatusId, userId, comment);
  },

  async link(issueId: string, userId: string, input: { targetIssueId?: string; targetIssueKey?: string; type: any }) {
    const source = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!source) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const target = input.targetIssueId
      ? await prisma.issue.findFirst({ where: { id: input.targetIssueId, projectId: source.projectId } })
      : await prisma.issue.findFirst({ where: { key: String(input.targetIssueKey).toUpperCase(), projectId: source.projectId } });
    if (!target) throw new AppError(404, 'TARGET_ISSUE_NOT_FOUND', 'Target issue not found in the same project');
    if (target.id === source.id) throw new AppError(422, 'INVALID_LINK', 'Issue cannot link to itself');
    const link = await prisma.issueLink.upsert({
      where: { sourceIssueId_targetIssueId_type: { sourceIssueId: source.id, targetIssueId: target.id, type: input.type } },
      update: {},
      create: { sourceIssueId: source.id, targetIssueId: target.id, type: input.type, createdById: userId },
      include: { targetIssue: issueSummary, createdBy: userSummary }
    });
    await prisma.issueHistory.create({ data: { issueId: source.id, userId, field: 'link', oldValue: null, newValue: `${input.type}:${target.key}` } });
    emitToProject(source.projectId, 'issue:updated', { id: source.id });
    return link;
  },

  async bulk(projectId: string, userId: string, input: { issueIds: string[]; action: string; value?: any }) {
    if (input.action === 'DELETE') {
      const res = await prisma.issue.deleteMany({ where: { projectId, id: { in: input.issueIds } } });
      return { updated: res.count };
    }
    if (input.action === 'LABEL') {
      const labels = splitLabels(Array.isArray(input.value) ? input.value : String(input.value ?? '').split(','));
      await prisma.$transaction(async (tx) => {
        for (const issueId of input.issueIds) await replaceLabels(tx, projectId, issueId, labels);
        await tx.issueHistory.createMany({ data: input.issueIds.map((issueId) => ({ issueId, userId, field: 'labels', oldValue: null, newValue: labels.join(', ') })) });
      });
      return { updated: input.issueIds.length };
    }
    const data: any = {};
    if (input.action === 'ASSIGN') data.assigneeId = input.value || null;
    if (input.action === 'STATUS') data.workflowStatusId = input.value;
    if (input.action === 'PRIORITY') data.priority = input.value;
    const res = await prisma.issue.updateMany({ where: { projectId, id: { in: input.issueIds } }, data });
    await prisma.issueHistory.createMany({ data: input.issueIds.map((issueId) => ({ issueId, userId, field: input.action.toLowerCase(), oldValue: null, newValue: String(input.value ?? '') })) });
    return { updated: res.count };
  }
};
