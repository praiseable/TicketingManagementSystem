import crypto from 'node:crypto';
import { prisma, ProjectRole } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';
import { settingsStore } from '../services/settings-store.service.js';
import { auditService } from '../services/audit.service.js';

function asString(value: unknown): string {
  if (Array.isArray(value)) return asString(value[0]);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new AppError(400, 'PARAM_REQUIRED', 'Required parameter is missing');
}

function ensureArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function assertProject(orgId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, orgId }, select: { id: true, settings: true } });
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  return project;
}

function defaultRules() {
  return {
    browse: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER],
    createIssue: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER],
    editIssue: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER],
    transitionIssue: [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER],
    manageProject: [ProjectRole.OWNER, ProjectRole.ADMIN],
    manageDocs: [ProjectRole.OWNER, ProjectRole.ADMIN],
  };
}

function settingsOf(project: any) {
  const settings = project?.settings && typeof project.settings === 'object' && !Array.isArray(project.settings) ? project.settings : {};
  const schemes = ensureArray(settings.permissionSchemes);
  return { settings, schemes };
}

export const permissionSchemesController = {
  list: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    const project = await assertProject(req.user!.orgId, projectId);
    const { settings, schemes } = settingsOf(project);
    ok(res, { activeSchemeId: settings.activePermissionSchemeId ?? null, schemes });
  }),

  create: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    await assertProject(req.user!.orgId, projectId);
    const now = new Date().toISOString();
    const scheme = {
      id: crypto.randomUUID(),
      name: String(req.body?.name || 'Default Permission Scheme').trim(),
      description: req.body?.description ? String(req.body.description) : '',
      rules: req.body?.rules && typeof req.body.rules === 'object' ? req.body.rules : defaultRules(),
      createdAt: now,
      updatedAt: now,
      createdById: req.user!.id,
    };
    const updated = await settingsStore.updateProject(projectId, (settings) => {
      const schemes = ensureArray(settings.permissionSchemes);
      settings.permissionSchemes = [...schemes, scheme];
      if (!settings.activePermissionSchemeId) settings.activePermissionSchemeId = scheme.id;
    });
    await auditService.record({ orgId: req.user!.orgId, userId: req.user!.id, action: 'project.permissionScheme.create', entityType: 'project', entityId: projectId, newData: scheme, ipAddress: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
    created(res, scheme);
  }),

  update: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    const schemeId = asString((req.params as any).schemeId);
    let scheme: any;
    await assertProject(req.user!.orgId, projectId);
    await settingsStore.updateProject(projectId, (settings) => {
      const schemes = ensureArray(settings.permissionSchemes);
      const index = schemes.findIndex((s: any) => s?.id === schemeId);
      if (index < 0) throw new AppError(404, 'PERMISSION_SCHEME_NOT_FOUND', 'Permission scheme not found');
      scheme = { ...schemes[index], ...req.body, id: schemeId, updatedAt: new Date().toISOString() };
      schemes[index] = scheme;
      settings.permissionSchemes = schemes;
    });
    ok(res, scheme);
  }),

  apply: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    const schemeId = asString((req.params as any).schemeId);
    let scheme: any;
    await assertProject(req.user!.orgId, projectId);
    await settingsStore.updateProject(projectId, (settings) => {
      const schemes = ensureArray(settings.permissionSchemes);
      scheme = schemes.find((s: any) => s?.id === schemeId);
      if (!scheme) throw new AppError(404, 'PERMISSION_SCHEME_NOT_FOUND', 'Permission scheme not found');
      settings.activePermissionSchemeId = schemeId;
    });
    await auditService.record({ orgId: req.user!.orgId, userId: req.user!.id, action: 'project.permissionScheme.apply', entityType: 'project', entityId: projectId, newData: { schemeId }, ipAddress: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
    ok(res, { activeSchemeId: schemeId, scheme });
  }),

  remove: asyncHandler(async (req, res) => {
    const projectId = asString((req.params as any).projectId ?? (req.params as any).id);
    const schemeId = asString((req.params as any).schemeId);
    await assertProject(req.user!.orgId, projectId);
    await settingsStore.updateProject(projectId, (settings) => {
      const schemes = ensureArray(settings.permissionSchemes);
      settings.permissionSchemes = schemes.filter((s: any) => s?.id !== schemeId);
      if (settings.activePermissionSchemeId === schemeId) settings.activePermissionSchemeId = settings.permissionSchemes[0]?.id ?? null;
    });
    noContent(res);
  }),
};
