import { prisma } from '@pm-platform/db';

export type JsonRecord = Record<string, any>;

function cloneSettings(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

export const settingsStore = {
  async getProject(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, orgId: true, key: true, name: true, settings: true } });
    if (!project) return null;
    return { ...project, settings: cloneSettings(project.settings) };
  },

  async updateProject(projectId: string, updater: (settings: JsonRecord) => JsonRecord | void) {
    const project = await this.getProject(projectId);
    if (!project) return null;
    const settings = cloneSettings(project.settings);
    const next = updater(settings) || settings;
    const updated = await prisma.project.update({ where: { id: projectId }, data: { settings: next }, select: { id: true, orgId: true, key: true, name: true, settings: true } });
    return { ...updated, settings: cloneSettings(updated.settings) };
  },

  async getOrg(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, slug: true, settings: true } });
    if (!org) return null;
    return { ...org, settings: cloneSettings(org.settings) };
  },

  async updateOrg(orgId: string, updater: (settings: JsonRecord) => JsonRecord | void) {
    const org = await this.getOrg(orgId);
    if (!org) return null;
    const settings = cloneSettings(org.settings);
    const next = updater(settings) || settings;
    const updated = await prisma.organization.update({ where: { id: orgId }, data: { settings: next }, select: { id: true, name: true, slug: true, settings: true } });
    return { ...updated, settings: cloneSettings(updated.settings) };
  },
};
