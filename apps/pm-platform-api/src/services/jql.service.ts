import { prisma, Priority } from '@pm-platform/db';

type JqlToken = {
  field: string;
  operator: ':' | '=' | '!=' | '>=' | '<=' | '>' | '<';
  value: string;
};

type JqlOptions = {
  orgId: string;
  userId: string;
  page?: number;
  limit?: number;
  projectId?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined | null) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function uuidEquals(field: string, value: string) {
  return isUuid(value) ? { [field]: value } : undefined;
}

function compactOr(items: Array<any | undefined | null>) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return undefined;
  if (filtered.length === 1) return filtered[0];
  return { OR: filtered };
}

function stripQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitJql(input: string) {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;

  for (const ch of input.trim()) {
    if ((ch === '"' || ch === "'") && (!quote || quote === ch)) {
      quote = quote ? null : ch;
      current += ch;
      continue;
    }

    if (!quote && /\s/.test(ch)) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens.filter((token) => !['AND', 'and'].includes(token));
}

export function parseJql(input: string): JqlToken[] {
  return splitJql(input || '').map((raw) => {
    const match = raw.match(/^([A-Za-z][A-Za-z0-9_.-]*)(!=|>=|<=|:|=|>|<)(.+)$/);

    if (!match) {
      return {
        field: 'text',
        operator: ':' as const,
        value: stripQuotes(raw),
      };
    }

    return {
      field: match[1].toLowerCase(),
      operator: match[2] as JqlToken['operator'],
      value: stripQuotes(match[3]),
    };
  });
}

function dateFilter(operator: JqlToken['operator'], raw: string) {
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return undefined;

  if (operator === '>=' || operator === '>') {
    return { gte: date };
  }

  if (operator === '<=' || operator === '<') {
    date.setHours(23, 59, 59, 999);
    return { lte: date };
  }

  return undefined;
}

function compactIssue(issue: any) {
  const labels = (issue.labels ?? [])
    .map((row: any) => row.label)
    .filter(Boolean);

  return {
    id: issue.id,
    key: issue.key,
    projectId: issue.projectId,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    storyPoints: issue.storyPoints,
    dueDate: issue.dueDate,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    project: issue.project
      ? {
          id: issue.project.id,
          key: issue.project.key,
          name: issue.project.name,
        }
      : null,
    issueType: issue.issueType
      ? {
          id: issue.issueType.id,
          name: issue.issueType.name,
          color: issue.issueType.color,
          icon: issue.issueType.icon,
        }
      : null,
    workflowStatus: issue.workflowStatus
      ? {
          id: issue.workflowStatus.id,
          name: issue.workflowStatus.name,
          category: issue.workflowStatus.category,
          color: issue.workflowStatus.color,
        }
      : null,
    assignee: issue.assignee
      ? {
          id: issue.assignee.id,
          name: issue.assignee.name,
          email: issue.assignee.email,
          avatarUrl: issue.assignee.avatarUrl,
        }
      : null,
    labels,
    labelNames: labels.map((label: any) => label.name),
  };
}

export const jqlService = {
  async query(input: string, options: JqlOptions) {
    const page = Math.max(1, Number(options.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(options.limit ?? 25)));
    const tokens = parseJql(input);

    const where: any = {
      project: {
        orgId: options.orgId,
        isArchived: false,
      },
    };

    const and: any[] = [];
    const not: any[] = [];

    if (isUuid(options.projectId)) {
      and.push({ projectId: options.projectId });
    }

    for (const token of tokens) {
      const value = token.value;
      const lowerValue = value.toLowerCase();
      const upperValue = value.toUpperCase();
      const negative = token.operator === '!=';

      const push = (condition: any | undefined) => {
        if (!condition) return;
        if (negative) not.push(condition);
        else and.push(condition);
      };

      switch (token.field) {
        case 'project':
          push(
            compactOr([
              uuidEquals('projectId', value),
              {
                project: {
                  key: {
                    equals: value,
                    mode: 'insensitive',
                  },
                },
              },
              {
                project: {
                  name: {
                    contains: value,
                    mode: 'insensitive',
                  },
                },
              },
            ])
          );
          break;

        case 'key':
        case 'issue':
          push({
            key: {
              equals: value,
              mode: 'insensitive',
            },
          });
          break;

        case 'type':
        case 'issuetype':
          push(
            compactOr([
              uuidEquals('issueTypeId', value),
              {
                issueType: {
                  name: {
                    contains: value,
                    mode: 'insensitive',
                  },
                },
              },
            ])
          );
          break;

        case 'status': {
          const validCategories = ['TODO', 'IN_PROGRESS', 'DONE'];
          push(
            compactOr([
              uuidEquals('workflowStatusId', value),
              {
                workflowStatus: {
                  name: {
                    contains: value,
                    mode: 'insensitive',
                  },
                },
              },
              validCategories.includes(upperValue)
                ? {
                    workflowStatus: {
                      category: upperValue as any,
                    },
                  }
                : undefined,
            ])
          );
          break;
        }

        case 'priority': {
          const validPriority = Object.values(Priority).includes(upperValue as Priority);
          push({
            priority: validPriority ? upperValue : value,
          });
          break;
        }

        case 'assignee':
          if (lowerValue === 'me') {
            push({ assigneeId: options.userId });
          } else if (['none', 'null', 'unassigned'].includes(lowerValue)) {
            push({ assigneeId: null });
          } else {
            push(
              compactOr([
                uuidEquals('assigneeId', value),
                {
                  assignee: {
                    email: {
                      contains: value,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  assignee: {
                    name: {
                      contains: value,
                      mode: 'insensitive',
                    },
                  },
                },
              ])
            );
          }
          break;

        case 'reporter':
          if (lowerValue === 'me') {
            push({ reporterId: options.userId });
          } else {
            push(
              compactOr([
                uuidEquals('reporterId', value),
                {
                  reporter: {
                    email: {
                      contains: value,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  reporter: {
                    name: {
                      contains: value,
                      mode: 'insensitive',
                    },
                  },
                },
              ])
            );
          }
          break;

        case 'label':
        case 'labels':
          push({
            labels: {
              some: {
                label: {
                  name: {
                    contains: value,
                    mode: 'insensitive',
                  },
                },
              },
            },
          });
          break;

        case 'sprint':
          if (['none', 'null', 'backlog'].includes(lowerValue)) {
            push({ sprintId: null });
          } else {
            push(
              compactOr([
                uuidEquals('sprintId', value),
                {
                  sprint: {
                    name: {
                      contains: value,
                      mode: 'insensitive',
                    },
                  },
                },
              ])
            );
          }
          break;

        case 'created':
        case 'createdat': {
          const filter = dateFilter(token.operator, value);
          if (filter) push({ createdAt: filter });
          break;
        }

        case 'updated':
        case 'updatedat': {
          const filter = dateFilter(token.operator, value);
          if (filter) push({ updatedAt: filter });
          break;
        }

        case 'text':
        case 'summary':
        case 'title':
        default:
          push({
            OR: [
              {
                key: {
                  contains: value,
                  mode: 'insensitive',
                },
              },
              {
                title: {
                  contains: value,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: value,
                  mode: 'insensitive',
                },
              },
              {
                comments: {
                  some: {
                    body: {
                      contains: value,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          });
          break;
      }
    }

    if (and.length) where.AND = and;
    if (not.length) where.NOT = not;

    const [total, rows] = await Promise.all([
      prisma.issue.count({ where }),
      prisma.issue.findMany({
        where,
        include: {
          project: true,
          issueType: true,
          workflowStatus: true,
          assignee: true,
          labels: {
            include: {
              label: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(compactIssue),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        engine: 'postgres-jql',
        jql: input,
        tokens,
      },
    };
  },

  async autocomplete(orgId: string, projectId?: string, q = '') {
    const term = q.trim().toLowerCase();
    const match = (value: string) => !term || value.toLowerCase().includes(term);

    const projectWhere: any = {
      orgId,
      isArchived: false,
    };

    if (isUuid(projectId)) {
      projectWhere.id = projectId;
    }

    const scopedProjectRelation: any = {
      orgId,
      ...(isUuid(projectId) ? { id: projectId } : {}),
    };

    const [projects, statuses, assignees, labels, sprints] = await Promise.all([
      prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          key: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
        take: 20,
      }),
      prisma.workflowStatus.findMany({
        where: {
          workflow: {
            project: scopedProjectRelation,
          },
        },
        select: {
          id: true,
          name: true,
          category: true,
        },
        orderBy: {
          position: 'asc',
        },
        take: 50,
      }),
      prisma.user.findMany({
        where: {
          orgId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: 'asc',
        },
        take: 50,
      }),
      prisma.label.findMany({
        where: {
          project: scopedProjectRelation,
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
        orderBy: {
          name: 'asc',
        },
        take: 50,
      }),
      prisma.sprint.findMany({
        where: {
          project: scopedProjectRelation,
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      }),
    ]);

    return {
      fields: [
        'project',
        'key',
        'text',
        'type',
        'status',
        'priority',
        'assignee',
        'reporter',
        'label',
        'sprint',
        'created',
        'updated',
      ].filter(match),
      operators: [':', '=', '!=', '>=', '<=', '>', '<'],
      examples: [
        'project:PM assignee:me status!=Done',
        'priority:HIGH label:backend',
        'text:"login bug" sprint:none',
        'created>=2026-01-01',
      ],
      projects,
      statuses,
      assignees,
      labels,
      sprints,
    };
  },
};
