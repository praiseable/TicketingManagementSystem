import crypto from 'node:crypto';
import { prisma, ProjectRole, StatusCategory } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

function asString(value: unknown): string | undefined {
  if (Array.isArray(value)) return asString(value[0]);
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v || undefined;
}

function normalizeKey(key: string) {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

async function getProjectForResponse(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      },
      issueTypes: { orderBy: { position: 'asc' } },
      customFields: { orderBy: { position: 'asc' } },
      workflows: {
        include: {
          statuses: { orderBy: { position: 'asc' } },
          transitions: {
            include: { fromStatus: true, toStatus: true, guards: true, postFns: true },
            orderBy: { name: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      invitations: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' }
      },
      _count: { select: { issues: true, members: true, invitations: true } }
    }
  });
}

async function ensureOrgProjectKeyAvailable(orgId: string, key: string, excludeProjectId?: string) {
  const existing = await prisma.project.findFirst({
    where: {
      orgId,
      key,
      ...(excludeProjectId ? { id: { not: excludeProjectId } } : {})
    },
    select: { id: true }
  });
  if (existing) throw new AppError(409, 'PROJECT_KEY_EXISTS', `Project key ${key} already exists in this organization`);
}

async function assertProjectInOrg(projectId: string, orgId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, orgId } });
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  return project;
}

async function countOwners(projectId: string) {
  return prisma.projectMember.count({ where: { projectId, role: ProjectRole.OWNER } });
}

export const projectsController = {
  list: asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: {
        orgId: req.user!.orgId,
        isArchived: false,
        members: { some: { userId: req.user!.id } }
      },
      include: {
        lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: { where: { userId: req.user!.id }, select: { role: true } },
        _count: { select: { issues: true, members: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    ok(res, projects.map((project) => ({
      ...project,
      currentUserRole: project.members[0]?.role ?? null,
      members: undefined
    })));
  }),

  create: asyncHandler(async (req, res) => {
    const key = normalizeKey(req.body.key);
    if (!key || key.length < 2) throw new AppError(400, 'INVALID_PROJECT_KEY', 'Project key must contain at least two letters/numbers');
    await ensureOrgProjectKeyAvailable(req.user!.orgId, key);

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          orgId: req.user!.orgId,
          leadId: req.user!.id,
          name: req.body.name.trim(),
          key,
          description: req.body.description?.trim() || null,
          iconUrl: req.body.iconUrl || null,
          settings: req.body.settings ?? {},
          members: { create: { userId: req.user!.id, role: ProjectRole.OWNER } },
          issueTypes: {
            create: [
              { name: 'Bug', color: '#ef4444', icon: 'bug', isDefault: true, position: 1 },
              { name: 'Story', color: '#22c55e', icon: 'book-open', isDefault: false, position: 2 },
              { name: 'Task', color: '#3b82f6', icon: 'check-circle', isDefault: false, position: 3 }
            ]
          }
        }
      });

      const workflow = await tx.workflow.create({ data: { projectId: createdProject.id, name: 'Default workflow', isDefault: true } });
      const statusDefs = [
        { name: 'Backlog', color: '#64748b', category: StatusCategory.TODO, position: 1, wipLimit: null },
        { name: 'Todo', color: '#0ea5e9', category: StatusCategory.TODO, position: 2, wipLimit: null },
        { name: 'In Progress', color: '#f59e0b', category: StatusCategory.IN_PROGRESS, position: 3, wipLimit: 5 },
        { name: 'In Review', color: '#8b5cf6', category: StatusCategory.IN_PROGRESS, position: 4, wipLimit: 4 },
        { name: 'Done', color: '#22c55e', category: StatusCategory.DONE, position: 5, wipLimit: null }
      ];

      const statuses = [] as { id: string; name: string }[];
      for (const def of statusDefs) {
        statuses.push(await tx.workflowStatus.create({ data: { ...def, workflowId: workflow.id }, select: { id: true, name: true } }));
      }

      for (let i = 0; i < statuses.length - 1; i += 1) {
        await tx.workflowTransition.create({
          data: {
            workflowId: workflow.id,
            fromStatusId: statuses[i].id,
            toStatusId: statuses[i + 1].id,
            name: `${statuses[i].name} → ${statuses[i + 1].name}`
          }
        });
      }

      return createdProject;
    });

    created(res, await getProjectForResponse(project.id));
  }),

  get: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    if (!projectId) throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required');
    const project = await getProjectForResponse(projectId);
    if (!project || project.orgId !== req.user!.orgId) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    ok(res, project);
  }),

  update: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    if (!projectId) throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required');
    await assertProjectInOrg(projectId, req.user!.orgId);

    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.iconUrl !== undefined) data.iconUrl = req.body.iconUrl;
    if (req.body.settings !== undefined) data.settings = req.body.settings;
    if (req.body.isArchived !== undefined) data.isArchived = req.body.isArchived;

    const project = await prisma.project.update({ where: { id: projectId }, data });
    ok(res, await getProjectForResponse(project.id));
  }),

  remove: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    if (!projectId) throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required');
    await assertProjectInOrg(projectId, req.user!.orgId);
    await prisma.project.update({ where: { id: projectId }, data: { isArchived: true } });
    noContent(res);
  }),

  invite: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    if (!projectId) throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required');
    await assertProjectInOrg(projectId, req.user!.orgId);

    const email = String(req.body.email).trim().toLowerCase();
    const role = (req.body.role ?? ProjectRole.MEMBER) as ProjectRole;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400_000);

    const existingUser = await prisma.user.findUnique({ where: { email } });

    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.create({
        data: {
          orgId: req.user!.orgId,
          projectId,
          email,
          role,
          token,
          expiresAt,
          invitedById: req.user!.id
        }
      });

      let membership = null as unknown;
      if (existingUser && existingUser.orgId === req.user!.orgId) {
        membership = await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: existingUser.id } },
          update: { role },
          create: { projectId, userId: existingUser.id, role },
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, role: true } } }
        });
        await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      }

      return { invitation, membership };
    });

    created(res, {
      invitation: {
        ...result.invitation,
        token: undefined,
        devToken: token
      },
      existingUserAdded: Boolean(result.membership),
      membership: result.membership
    });
  }),

  members: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    if (!projectId) throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required');
    await assertProjectInOrg(projectId, req.user!.orgId);

    ok(res, await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, role: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }]
    }));
  }),

  updateMember: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    const userId = asString((req.params as any).userId);
    if (!projectId || !userId) throw new AppError(400, 'PROJECT_MEMBER_ID_REQUIRED', 'Project id and user id are required');
    await assertProjectInOrg(projectId, req.user!.orgId);

    const current = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!current) throw new AppError(404, 'PROJECT_MEMBER_NOT_FOUND', 'Project member not found');

    const nextRole = req.body.role as ProjectRole;
    if (current.role === ProjectRole.OWNER && nextRole !== ProjectRole.OWNER && (await countOwners(projectId)) <= 1) {
      throw new AppError(409, 'LAST_OWNER_REQUIRED', 'Project must keep at least one owner');
    }

    const member = await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: nextRole },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, role: true } } }
    });
    ok(res, member);
  }),

  removeMember: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).id) ?? asString((req.params as any).projectId);
    const userId = asString((req.params as any).userId);
    if (!projectId || !userId) throw new AppError(400, 'PROJECT_MEMBER_ID_REQUIRED', 'Project id and user id are required');
    await assertProjectInOrg(projectId, req.user!.orgId);

    const current = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!current) throw new AppError(404, 'PROJECT_MEMBER_NOT_FOUND', 'Project member not found');

    if (current.role === ProjectRole.OWNER && (await countOwners(projectId)) <= 1) {
      throw new AppError(409, 'LAST_OWNER_REQUIRED', 'Project must keep at least one owner');
    }

    await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    noContent(res);
  })
};
