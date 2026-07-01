import { z } from 'zod';

export const id = z.string().uuid();
export const idParam = z.object({ id });
export const projectIdParam = z.object({ projectId: id });
export const issueIdParam = z.object({ issueId: id });
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
}).passthrough();

export const authSchemas = {
  register: z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), orgName: z.string().min(2).optional() }),
  login: z.object({ email: z.string().email(), password: z.string().min(1) }),
  refresh: z.object({ refreshToken: z.string().min(10) }),
  forgotPassword: z.object({ email: z.string().email() }),
  resetPassword: z.object({ token: z.string().min(10), password: z.string().min(8) }),
  verifyEmail: z.object({ token: z.string().min(10) })
};

export const userSchemas = {
  update: z.object({ name: z.string().min(2).optional(), avatarUrl: z.string().url().nullable().optional() }),
  password: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
};

export const projectSchemas = {
  create: z.object({ name: z.string().min(2), key: z.string().min(2).max(10).regex(/^[A-Z][A-Z0-9]+$/), description: z.string().nullable().optional(), iconUrl: z.string().url().nullable().optional(), settings: z.record(z.unknown()).optional() }),
  update: z.object({ name: z.string().min(2).optional(), description: z.string().nullable().optional(), iconUrl: z.string().url().nullable().optional(), settings: z.record(z.unknown()).optional(), isArchived: z.boolean().optional() }),
  invite: z.object({ email: z.string().email(), role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER') }),
  member: z.object({ role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']) })
};

export const issueSchemas = {
  create: z.object({
    issueTypeId: id.optional(),
    workflowStatusId: id.optional(),
    title: z.string().min(2),
    description: z.string().nullable().optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).default('MEDIUM'),
    assigneeId: id.nullable().optional(),
    parentId: id.nullable().optional(),
    sprintId: id.nullable().optional(),
    labels: z.union([z.array(z.string()), z.string()]).optional(),
    customFields: z.record(z.unknown()).optional(),
    storyPoints: z.coerce.number().int().nullable().optional(),
    originalEstimate: z.coerce.number().int().nullable().optional(),
    remainingEstimate: z.coerce.number().int().nullable().optional(),
    dueDate: z.string().nullable().optional()
  }),
  update: z.object({
    title: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
    assigneeId: id.nullable().optional(),
    issueTypeId: id.optional(),
    workflowStatusId: id.optional(),
    parentId: id.nullable().optional(),
    sprintId: id.nullable().optional(),
    storyPoints: z.coerce.number().int().nullable().optional(),
    originalEstimate: z.coerce.number().int().nullable().optional(),
    remainingEstimate: z.coerce.number().int().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    customFields: z.record(z.unknown()).optional(),
    labels: z.union([z.array(z.string()), z.string()]).optional()
  }),
  transition: z.object({ toStatusId: id, comment: z.string().optional() }),
  link: z.object({
    targetIssueId: id.optional(),
    targetIssueKey: z.string().min(2).optional(),
    type: z.enum(['BLOCKS', 'BLOCKED_BY', 'DUPLICATES', 'DUPLICATED_BY', 'RELATES_TO', 'CLONES'])
  }).refine((v) => Boolean(v.targetIssueId || v.targetIssueKey), { message: 'targetIssueId or targetIssueKey is required' }),
  bulk: z.object({ issueIds: z.array(id).min(1), action: z.enum(['ASSIGN', 'LABEL', 'STATUS', 'PRIORITY', 'DELETE']), value: z.unknown().optional() })
};

export const workflowSchemas = {
  workflow: z.object({ name: z.string().min(2), isDefault: z.boolean().optional() }),
  status: z.object({ name: z.string().min(2), color: z.string().default('#64748b'), category: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).default('TODO'), position: z.number().optional(), wipLimit: z.number().int().nullable().optional() }),
  transition: z.object({ fromStatusId: id, toStatusId: id, name: z.string().min(2) }),
  guard: z.object({ type: z.enum(['REQUIRED_FIELD', 'ASSIGNEE_SET', 'PERMISSION']), fieldId: id.nullable().optional(), config: z.record(z.unknown()).default({}) })
};

export const typeSchemas = {
  issueType: z.object({
    name: z.string().min(2),
    color: z.string().default('#64748b'),
    icon: z.string().default('circle'),
    isDefault: z.boolean().optional(),
    position: z.coerce.number().optional(),
    customFieldIds: z.array(id).optional()
  }),
  customField: z.object({
    name: z.string().min(2),
    key: z.string().min(2).optional(),
    type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATETIME', 'DROPDOWN', 'MULTISELECT', 'USER', 'CHECKBOX', 'URL']),
    options: z.unknown().optional(),
    isRequired: z.boolean().optional(),
    position: z.coerce.number().optional(),
    issueTypeIds: z.array(id).optional()
  })
};

export const commentSchemas = { body: z.object({ body: z.string().min(1), parentId: id.optional() }) };
export const sprintSchemas = {
  create: z.object({
    name: z.string().min(2),
    goal: z.string().nullable().optional(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    capacity: z.coerce.number().int().min(0).optional()
  }),
  update: z.object({
    name: z.string().min(2).optional(),
    goal: z.string().nullable().optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    capacity: z.coerce.number().int().min(0).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional()
  }),
  complete: z.object({ moveToSprintId: id.nullable().optional() })
};
export const backlogSchemas = {
  reorder: z.object({ issueId: id, newPosition: z.coerce.number() }),
  moveToSprint: z.object({ issueIds: z.array(id).min(1), sprintId: id.nullable().optional() })
};
export const worklogSchemas = {
  create: z.object({ timeSpent: z.coerce.number().int().positive(), dateStarted: z.string().min(1), description: z.string().nullable().optional() }),
  update: z.object({ timeSpent: z.coerce.number().int().positive().optional(), dateStarted: z.string().min(1).optional(), description: z.string().nullable().optional() })
};
export const timerSchemas = { issue: z.object({ issueId: id, description: z.string().nullable().optional() }) };
export const notificationSchemas = { prefs: z.object({ prefs: z.array(z.object({ eventType: z.string(), inApp: z.boolean(), email: z.boolean() })) }) };
export const webhookSchemas = { config: z.object({ url: z.string().url(), events: z.array(z.string()).min(1), secret: z.string().nullable().optional(), isActive: z.boolean().optional() }) };
export const spaceSchemas = { create: z.object({ type: z.enum(['TEAM', 'PROJECT', 'PERSONAL']).default('TEAM'), name: z.string().min(2), key: z.string().min(2), description: z.string().optional(), iconUrl: z.string().url().optional() }), update: z.object({ name: z.string().min(2).optional(), description: z.string().nullable().optional(), iconUrl: z.string().url().nullable().optional(), isArchived: z.boolean().optional() }) };
export const pageSchemas = { create: z.object({ title: z.string().min(1), parentId: id.nullable().optional(), content: z.string().optional(), contentJson: z.unknown().optional(), template: z.enum(['blank', 'requirements', 'meeting', 'retrospective', 'adr']).optional(), publishedAt: z.string().datetime().nullable().optional() }), update: z.object({ title: z.string().min(1).optional(), content: z.string().optional(), contentJson: z.unknown().optional(), parentId: id.nullable().optional(), publishedAt: z.string().datetime().nullable().optional() }) };
export const searchSchemas = { saveFilter: z.object({ name: z.string().min(2), projectId: id.optional(), filters: z.record(z.unknown()).default({}), jql: z.string().optional() }) };



export const githubSchemas = {
  commit: z.object({
    sha: z.string().min(6),
    message: z.string().min(1),
    url: z.string().url().optional(),
    author: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().optional()
  }),
  commits: z.object({
    commits: z.array(z.object({
      sha: z.string().min(6).optional(),
      id: z.string().min(6).optional(),
      message: z.string().min(1),
      url: z.string().url().optional(),
      html_url: z.string().url().optional(),
      author: z.unknown().optional(),
      repo: z.string().optional(),
      branch: z.string().optional()
    })).min(1).optional(),
    sha: z.string().min(6).optional(),
    id: z.string().min(6).optional(),
    message: z.string().min(1).optional(),
    url: z.string().url().optional(),
    repository: z.unknown().optional()
  }).passthrough()
};
