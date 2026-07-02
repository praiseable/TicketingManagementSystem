import crypto from 'node:crypto';
import { prisma } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';
import { auditService } from '../services/audit.service.js';
import { settingsStore } from '../services/settings-store.service.js';

function groups(settings: any) {
  return Array.isArray(settings.userGroups) ? settings.userGroups : [];
}

function groupResponse(group: any, users: any[]) {
  const userMap = new Map(users.map((u) => [u.id, u]));
  return {
    ...group,
    users: (group.userIds ?? []).map((id: string) => userMap.get(id)).filter(Boolean),
    userCount: (group.userIds ?? []).length,
  };
}

async function loadUsers(orgId: string, userIds: string[]) {
  return prisma.user.findMany({ where: { orgId, id: { in: userIds } }, select: { id: true, email: true, name: true, role: true, isActive: true } });
}

export const groupsController = {
  list: asyncHandler(async (req, res) => {
    const org = await settingsStore.getOrg(req.user!.orgId);
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
    const rows = groups(org.settings);
    const userIds = [...new Set(rows.flatMap((g: any) => g.userIds ?? []))];
    const users = await loadUsers(req.user!.orgId, userIds);
    ok(res, rows.map((g: any) => groupResponse(g, users)));
  }),

  create: asyncHandler(async (req, res) => {
    const now = new Date().toISOString();
    const group = { id: crypto.randomUUID(), name: String(req.body?.name || 'New Group').trim(), description: String(req.body?.description || ''), userIds: [], createdAt: now, updatedAt: now, createdById: req.user!.id };
    await settingsStore.updateOrg(req.user!.orgId, (settings) => { settings.userGroups = [...groups(settings), group]; });
    await auditService.record({ orgId: req.user!.orgId, userId: req.user!.id, action: 'admin.group.create', entityType: 'group', entityId: group.id, newData: group, ipAddress: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
    created(res, group);
  }),

  addUser: asyncHandler(async (req, res) => {
    const groupId = String(req.params.groupId);
    const userId = String(req.body?.userId || req.params.userId || '');
    const user = await prisma.user.findFirst({ where: { id: userId, orgId: req.user!.orgId }, select: { id: true, email: true, name: true, role: true, isActive: true } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found in organization');
    let group: any;
    await settingsStore.updateOrg(req.user!.orgId, (settings) => {
      const rows = groups(settings);
      const index = rows.findIndex((g: any) => g.id === groupId);
      if (index < 0) throw new AppError(404, 'GROUP_NOT_FOUND', 'Group not found');
      group = { ...rows[index], userIds: [...new Set([...(rows[index].userIds ?? []), userId])], updatedAt: new Date().toISOString() };
      rows[index] = group;
      settings.userGroups = rows;
    });
    await auditService.record({ orgId: req.user!.orgId, userId: req.user!.id, action: 'admin.group.user.add', entityType: 'group', entityId: groupId, newData: { userId }, ipAddress: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
    ok(res, { ...group, users: [user] });
  }),

  removeUser: asyncHandler(async (req, res) => {
    const groupId = String(req.params.groupId);
    const userId = String(req.params.userId);
    await settingsStore.updateOrg(req.user!.orgId, (settings) => {
      const rows = groups(settings);
      const index = rows.findIndex((g: any) => g.id === groupId);
      if (index < 0) throw new AppError(404, 'GROUP_NOT_FOUND', 'Group not found');
      rows[index] = { ...rows[index], userIds: (rows[index].userIds ?? []).filter((id: string) => id !== userId), updatedAt: new Date().toISOString() };
      settings.userGroups = rows;
    });
    noContent(res);
  }),

  remove: asyncHandler(async (req, res) => {
    const groupId = String(req.params.groupId);
    await settingsStore.updateOrg(req.user!.orgId, (settings) => { settings.userGroups = groups(settings).filter((g: any) => g.id !== groupId); });
    noContent(res);
  }),
};
