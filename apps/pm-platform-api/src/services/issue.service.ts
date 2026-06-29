import { prisma, GlobalRole, NotificationType, ProjectRole, StatusCategory } from '@pm-platform/db';
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
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  return [...new Set(raw.map((label) => String(label).trim()).filter(Boolean))];
}

function nullableDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(String(value));
}

async function ensureProjectMember(userId: string | null | undefined, projectId: string) {
  if (!userId) return null;
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!member) throw new AppError(422, 'ASSIGNEE_NOT_PROJECT_MEMBER', 'Assignee must be a project member');
  return userId;
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

async function upsertCustomFields(tx: any, projectId: string, issueId: string, customFields: Record<string, unknown>, userId: string) {
  const ids = Object.keys(customFields ?? {});
  if (!ids.length) return;
  const valid = await tx.customField.findMany({ where: { id: { in: ids }, projectId }, select: { id: true, name: true } });
  const validIds = new Set(valid.map((f: any) => f.id));
  for (const id of ids) {
    if (!validIds.has(id)) throw new AppError(422, 'INVALID_CUSTOM_FIELD', `Custom field ${id} does not belong to this project`);
    const current = await tx.customFieldValue.findUnique({ where: { issueId_customFieldId: { issueId, customFieldId: id } } });
    const newValue = customFields[id] == null ? null : String(customFields[id]);
    await tx.customFieldValue.upsert({
      where: { issueId_customFieldId: { issueId, customFieldId: id } },
      update: { value: newValue },
      create: { issueId, customFieldId: id, value: newValue }
    });
    if (String(current?.value ?? '') !== String(newValue ?? '')) {
      await tx.issueHistory.create({ data: { issueId, userId, field: `customField:${id}`, oldValue: current?.value ?? null, newValue } });
    }
  }
}

function normalizeData(input: any) {
  const allowed = [
    'title', 'description', 'priority', 'assigneeId', 'issueTypeId', 'workflowStatusId', 'parentId',
    'sprintId', 'storyPoints', 'originalEstimate', 'remainingEstimate', 'dueDate'
  ];
  const data: any = {};
  for (const key of allowed) if (key in input) data[key] = input[key];
  if ('description' in data && data.description === undefined) delete data.description;
  if ('dueDate' in data) data.dueDate = nullableDate(data.dueDate);
  return data;
}


async function assertCanDelete(projectId: string, issueId: string, userId: string, globalRole: GlobalRole) {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, projectId },
    include: { children: true, sourceLinks: true, targetLinks: true }
  });
  if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  if (issue.reporterId === userId || globalRole === GlobalRole.ADMIN || globalRole === GlobalRole.SUPER_ADMIN) return issue;
  const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (membership?.role === ProjectRole.ADMIN || membership?.role === ProjectRole.OWNER) return issue;
  throw new AppError(403, 'FORBIDDEN', 'Only the issue creator, project admin/owner, or global admin can delete this issue');
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

    const status = await prisma.workflowStatus.findFirst({ where: { id: statusId, workflow: { projectId } } });
    if (!status) throw new AppError(422, 'INVALID_STATUS', 'Workflow status does not belong to this project');

    const assigneeId = await ensureProjectMember(input.assigneeId ?? null, projectId);

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
          workflowStatusId: status.id,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? 'MEDIUM',
          reporterId: userId,
          assigneeId,
          parentId: input.parentId ?? null,
          sprintId: input.sprintId ?? null,
          storyPoints: input.storyPoints ?? null,
          originalEstimate: input.originalEstimate ?? null,
          remainingEstimate: input.remainingEstimate ?? input.originalEstimate ?? null,
          dueDate: nullableDate(input.dueDate) as any,
          resolvedAt: status.category === StatusCategory.DONE ? new Date() : null,
          position: Date.now()
        },
        include: issueInclude
      });

      await tx.issueHistory.create({ data: { issueId: created.id, userId, field: 'created', oldValue: null, newValue: created.key } });
      if (created.assigneeId) await tx.issueHistory.create({ data: { issueId: created.id, userId, field: 'assigneeId', oldValue: null, newValue: created.assigneeId } });
      if (created.parentId) await tx.issueHistory.create({ data: { issueId: created.id, userId, field: 'parentId', oldValue: null, newValue: created.parentId } });
      if (labels.length) {
        await replaceLabels(tx, projectId, created.id, labels);
        await tx.issueHistory.create({ data: { issueId: created.id, userId, field: 'labels', oldValue: null, newValue: labels.join(', ') } });
      }
      if (input.customFields) await upsertCustomFields(tx, projectId, created.id, input.customFields, userId);
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
    const current = await prisma.issue.findFirst({
      where: { id: issueId, projectId },
      include: { workflowStatus: true, labels: { include: { label: true } }, customFieldValues: true }
    });
    if (!current) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

    const data = normalizeData(input);

    if ('assigneeId' in data) data.assigneeId = await ensureProjectMember(data.assigneeId ?? null, projectId);

    if (data.issueTypeId) {
      const issueType = await prisma.issueType.findFirst({ where: { id: data.issueTypeId, projectId } });
      if (!issueType) throw new AppError(422, 'INVALID_ISSUE_TYPE', 'Issue type does not belong to this project');
    }

    if (data.parentId) {
      if (data.parentId === issueId) throw new AppError(422, 'INVALID_PARENT', 'Issue cannot be its own parent');
      const parent = await prisma.issue.findFirst({ where: { id: data.parentId, projectId } });
      if (!parent) throw new AppError(404, 'PARENT_ISSUE_NOT_FOUND', 'Parent issue not found');
    }

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
      if ('labels' in input) {
        const labels = splitLabels(input.labels);
        await replaceLabels(tx, projectId, issueId, labels);
        const oldLabels = current.labels.map((x) => x.label.name).join(', ');
        if (oldLabels !== labels.join(', ')) await tx.issueHistory.create({ data: { issueId, userId, field: 'labels', oldValue: oldLabels, newValue: labels.join(', ') } });
      }
      if (input.customFields) await upsertCustomFields(tx, projectId, issueId, input.customFields, userId);
      return tx.issue.findUniqueOrThrow({ where: { id: issueId }, include: detailInclude });
    });

    emitToProject(projectId, 'issue:updated', updated);
    if (updated.assigneeId && updated.assigneeId !== current.assigneeId) await notificationService.notify(updated.assigneeId, NotificationType.ISSUE_ASSIGNED, `${updated.key} assigned`, updated.title, 'issue', updated.id);
    await webhookService.queueProjectEvent(projectId, 'issue.updated', updated);
    return updated;
  },

  async delete(projectId: string, issueId: string, userId: string, globalRole: GlobalRole) {
    const issue = await assertCanDelete(projectId, issueId, userId, globalRole);
    await webhookService.queueProjectEvent(projectId, 'issue.deleted', { id: issue.id, key: issue.key, deletedBy: userId, childCount: issue.children.length });
    await prisma.issue.delete({ where: { id: issueId } });
    emitToProject(projectId, 'issue:deleted', { id: issueId, key: issue.key });
    return { deleted: true, key: issue.key, childrenDeleted: issue.children.length };
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

  async unlink(issueId: string, linkId: string, userId: string) {
    const link = await prisma.issueLink.findUnique({ where: { id: linkId }, include: { sourceIssue: true, targetIssue: true } });
    if (!link || link.sourceIssueId !== issueId) throw new AppError(404, 'ISSUE_LINK_NOT_FOUND', 'Issue link not found');
    await prisma.issueLink.delete({ where: { id: linkId } });
    await prisma.issueHistory.create({ data: { issueId, userId, field: 'link.removed', oldValue: `${link.type}:${link.targetIssue.key}`, newValue: null } });
    emitToProject(link.sourceIssue.projectId, 'issue:updated', { id: issueId, linkDeleted: linkId });
  },

  async bulk(projectId: string, userId: string, input: { issueIds: string[]; action: string; value?: any }) {
    if (input.action === 'DELETE') {
      let updated = 0;
      for (const issueId of input.issueIds) {
        await this.delete(projectId, issueId, userId).then(() => { updated += 1; }).catch((error) => {
          if (error instanceof AppError && error.statusCode === 404) return;
          throw error;
        });
      }
      return { updated };
    }
    if (input.action === 'LABEL') {
      const labels = splitLabels(input.value);
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
