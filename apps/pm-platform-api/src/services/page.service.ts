import crypto from 'node:crypto';
import { createRedisConnection, prisma, RestrictionType, SpaceRole } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { emitToSpace } from '../sockets/index.js';

export const pageTemplates: Record<string, { id: string; name: string; description: string; content: string; contentJson: any }> = {
  blank: {
    id: 'blank',
    name: 'Blank page',
    description: 'A clean page for free-form writing.',
    content: '<p>Start writing…</p>',
    contentJson: { type: 'doc', content: [] }
  },
  requirements: {
    id: 'requirements',
    name: 'Requirements',
    description: 'Capture problem statement, scope, assumptions, and acceptance criteria.',
    content: '<h1>Requirements</h1><h2>Overview</h2><p>Describe the problem, users, assumptions, and acceptance criteria.</p><h2>Acceptance Criteria</h2><ul><li>Criterion 1</li><li>Criterion 2</li></ul>',
    contentJson: { type: 'doc', content: [] }
  },
  meeting: {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Agenda, decisions, and action items.',
    content: '<h1>Meeting Notes</h1><h2>Agenda</h2><ul><li>Topic</li></ul><h2>Decisions</h2><ul><li>Decision</li></ul><h2>Actions</h2><ul><li>Owner — Action — Due date</li></ul>',
    contentJson: { type: 'doc', content: [] }
  },
  retrospective: {
    id: 'retrospective',
    name: 'Retrospective',
    description: 'Went well, could improve, and actions.',
    content: '<h1>Retrospective</h1><h2>Went well</h2><ul><li>Item</li></ul><h2>Could improve</h2><ul><li>Item</li></ul><h2>Actions</h2><ul><li>Action</li></ul>',
    contentJson: { type: 'doc', content: [] }
  },
  adr: {
    id: 'adr',
    name: 'Architecture Decision Record',
    description: 'Context, decision, and consequences.',
    content: '<h1>Architecture Decision Record</h1><h2>Context</h2><p>Describe context.</p><h2>Decision</h2><p>Describe decision.</p><h2>Consequences</h2><p>Describe consequences.</p>',
    contentJson: { type: 'doc', content: [] }
  }
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'page';
}

async function uniqueSlug(spaceId: string, title: string, excludePageId?: string) {
  const base = slugify(title);
  let slug = base;
  let n = 2;

  while (true) {
    const existing = await prisma.page.findFirst({
      where: { spaceId, slug, ...(excludePageId ? { id: { not: excludePageId } } : {}) },
      select: { id: true }
    });

    if (!existing) return slug;
    slug = `${base}-${n++}`;
  }
}

function roleRank(role: SpaceRole) {
  if (role === SpaceRole.OWNER) return 3;
  if (role === SpaceRole.EDITOR) return 2;
  return 1;
}

function roleMatches(userRole: SpaceRole, requiredRole?: SpaceRole | null) {
  if (!requiredRole) return false;
  return roleRank(userRole) >= roleRank(requiredRole);
}

async function getSpaceWithMembership(spaceId: string, userId: string) {
  const space = await prisma.space.findFirst({
    where: { id: spaceId, isArchived: false },
    include: { members: true }
  });

  if (!space) throw new AppError(404, 'SPACE_NOT_FOUND', 'Space not found');

  const member = space.members.find((m) => m.userId === userId);
  if (!member) throw new AppError(403, 'SPACE_FORBIDDEN', 'You are not a member of this space');

  return { space, member };
}

async function assertSpaceMember(spaceId: string, userId: string, roles?: SpaceRole[]) {
  const { space, member } = await getSpaceWithMembership(spaceId, userId);

  if (roles?.length && !roles.includes(member.role)) {
    throw new AppError(403, 'SPACE_FORBIDDEN', 'Insufficient space permission');
  }

  return { space, member };
}

async function assertPageAccess(spaceId: string, pageId: string, userId: string, action: 'VIEW' | 'EDIT' = 'VIEW') {
  const { space, member } = await getSpaceWithMembership(spaceId, userId);

  const page = await prisma.page.findFirst({
    where: { id: pageId, spaceId, isArchived: false },
    include: { restrictions: true }
  });

  if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');

  if (member.role === SpaceRole.OWNER) return { space, member, page };

  const viewRestrictions = page.restrictions.filter((r) => r.type === RestrictionType.VIEW);
  if (viewRestrictions.length) {
    const allowed = viewRestrictions.some((r) => r.userId === userId || roleMatches(member.role, r.role as SpaceRole | null));
    if (!allowed) throw new AppError(403, 'PAGE_RESTRICTED', 'You are not allowed to view this page');
  }

  if (action === 'EDIT') {
    if (![SpaceRole.OWNER, SpaceRole.EDITOR].includes(member.role)) {
      throw new AppError(403, 'PAGE_EDIT_FORBIDDEN', 'You are not allowed to edit this page');
    }

    const editRestrictions = page.restrictions.filter((r) => r.type === RestrictionType.EDIT);
    if (editRestrictions.length) {
      const allowed = editRestrictions.some((r) => r.userId === userId || roleMatches(member.role, r.role as SpaceRole | null));
      if (!allowed) throw new AppError(403, 'PAGE_EDIT_RESTRICTED', 'You are not allowed to edit this page');
    }
  }

  return { space, member, page };
}

async function redis() {
  try {
    return createRedisConnection();
  } catch {
    return null;
  }
}

function htmlToText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function minimalPdf(title: string, body: string) {
  const text = `${title}\n\n${body}`.replace(/[()\\]/g, ' ');
  const content = `BT /F1 12 Tf 72 760 Td (${text.slice(0, 2500)}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj + '\n';
  }
  const xrefAt = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export const pageService = {
  templates() {
    return Object.values(pageTemplates).map(({ id, name, description, content }) => ({ id, name, description, content }));
  },

  assertSpaceMember,
  assertPageAccess,

  async create(spaceId: string, userId: string, input: any) {
    await assertSpaceMember(spaceId, userId, [SpaceRole.OWNER, SpaceRole.EDITOR]);

    const slug = await uniqueSlug(spaceId, input.title);
    const template = pageTemplates[input.template ?? 'blank'] ?? pageTemplates.blank;
    const content = input.content ?? template.content;
    const contentJson = input.contentJson ?? template.contentJson ?? { type: 'doc', content: [] };

    return prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          spaceId,
          title: input.title,
          slug,
          parentId: input.parentId ?? null,
          content,
          contentJson: contentJson as any,
          createdById: userId,
          updatedById: userId,
          publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date()
        }
      });

      await tx.pageVersion.create({ data: { pageId: page.id, version: page.version, content: page.content, contentJson: (page.contentJson ?? {}) as any, createdById: userId } });

      await tx.auditLog.create({
        data: {
          orgId: (await tx.space.findUniqueOrThrow({ where: { id: spaceId }, select: { orgId: true } })).orgId,
          userId,
          action: 'page.create',
          entityType: 'page',
          entityId: page.id,
          newData: { title: page.title, version: page.version, template: input.template ?? 'blank' },
          ipAddress: null,
          userAgent: null
        }
      });

      return page;
    });
  },

  async update(spaceId: string, pageId: string, userId: string, input: any) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');

    const page = await prisma.page.findFirst({ where: { id: pageId, spaceId, isArchived: false } });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');

    const nextVersion = page.version + 1;
    const nextTitle = input.title ?? page.title;
    const nextSlug = input.title ? await uniqueSlug(spaceId, input.title, pageId) : page.slug;
    const nextContent = input.content ?? page.content;
    const nextContentJson = input.contentJson ?? page.contentJson ?? {};

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.page.update({
        where: { id: pageId },
        data: {
          title: nextTitle,
          slug: nextSlug,
          content: nextContent,
          contentJson: nextContentJson as any,
          parentId: input.parentId === undefined ? page.parentId : input.parentId,
          publishedAt: input.publishedAt === undefined ? page.publishedAt : (input.publishedAt ? new Date(input.publishedAt) : null),
          version: nextVersion,
          updatedById: userId
        }
      });

      await tx.pageVersion.upsert({
        where: { pageId_version: { pageId, version: nextVersion } },
        create: { pageId, version: nextVersion, content: changed.content, contentJson: (changed.contentJson ?? {}) as any, createdById: userId },
        update: { content: changed.content, contentJson: (changed.contentJson ?? {}) as any, createdById: userId }
      });

      await tx.auditLog.create({
        data: {
          orgId: (await tx.space.findUniqueOrThrow({ where: { id: spaceId }, select: { orgId: true } })).orgId,
          userId,
          action: 'page.update',
          entityType: 'page',
          entityId: pageId,
          oldData: { title: page.title, version: page.version },
          newData: { title: changed.title, version: changed.version },
          ipAddress: null,
          userAgent: null
        }
      });

      return changed;
    });

    emitToSpace(spaceId, 'page:updated', { pageId, page: updated });
    return updated;
  },

  async restore(spaceId: string, pageId: string, version: number, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');

    const old = await prisma.pageVersion.findUnique({ where: { pageId_version: { pageId, version } } });
    if (!old) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');

    const page = await this.update(spaceId, pageId, userId, { content: old.content, contentJson: old.contentJson ?? {} });
    emitToSpace(spaceId, 'page:restored', { pageId, restoredFromVersion: version, page });
    return page;
  },

  async listRestrictions(spaceId: string, pageId: string, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'VIEW');
    return prisma.pageRestriction.findMany({ where: { pageId }, orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true, email: true } } } });
  },

  async createRestriction(spaceId: string, pageId: string, userId: string, input: any) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');

    const type = input.type as RestrictionType;
    const role = input.role ? input.role as SpaceRole : null;
    const targetUserId = input.userId ?? null;

    if (!role && !targetUserId) throw new AppError(400, 'RESTRICTION_TARGET_REQUIRED', 'role or userId is required');

    const row = await prisma.pageRestriction.create({
      data: { pageId, type, role, userId: targetUserId },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    await prisma.auditLog.create({
      data: {
        orgId: (await prisma.space.findUniqueOrThrow({ where: { id: spaceId }, select: { orgId: true } })).orgId,
        userId,
        action: 'page.restriction.create',
        entityType: 'page',
        entityId: pageId,
        newData: { type, role, userId: targetUserId },
        ipAddress: null,
        userAgent: null
      }
    });

    return row;
  },

  async deleteRestriction(spaceId: string, pageId: string, restrictionId: string, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');
    await prisma.pageRestriction.deleteMany({ where: { id: restrictionId, pageId } });
    return { deleted: true };
  },

  async listComments(spaceId: string, pageId: string, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'VIEW');
    return prisma.pageComment.findMany({ where: { pageId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } });
  },

  async createComment(spaceId: string, pageId: string, userId: string, input: any) {
    await assertPageAccess(spaceId, pageId, userId, 'VIEW');
    const comment = await prisma.pageComment.create({
      data: { pageId, userId, body: String(input.body ?? ''), selectionStart: input.selectionStart ?? null, selectionEnd: input.selectionEnd ?? null },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    emitToSpace(spaceId, 'page:commented', { pageId, comment });
    return comment;
  },

  async resolveComment(spaceId: string, pageId: string, commentId: string, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');
    return prisma.pageComment.update({ where: { id: commentId }, data: { resolvedAt: new Date() }, include: { user: { select: { id: true, name: true, email: true } } } });
  },

  async embedIssue(spaceId: string, pageId: string, userId: string, input: any) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');

    const issueKey = String(input.issueKey ?? '').trim().toUpperCase();
    const issueId = input.issueId as string | undefined;

    const issue = await prisma.issue.findFirst({
      where: {
        ...(issueId ? { id: issueId } : { key: issueKey }),
        project: { orgId: (await prisma.space.findUniqueOrThrow({ where: { id: spaceId }, select: { orgId: true } })).orgId }
      },
      include: { project: { select: { key: true, name: true } }, workflowStatus: true, assignee: { select: { id: true, name: true, email: true } } }
    });

    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found for embed');

    const page = await prisma.page.findFirstOrThrow({ where: { id: pageId, spaceId } });
    const card = `<div data-issue-embed="${issue.key}" style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;margin:8px 0"><strong>${issue.key}</strong> — ${issue.title}<br/><small>${issue.workflowStatus.name} · ${issue.priority}</small></div>`;
    const updated = await this.update(spaceId, pageId, userId, { content: `${page.content}\n${card}` });

    return { issue, page: updated, embedded: true };
  },

  async share(spaceId: string, pageId: string, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'EDIT');

    const token = crypto.randomBytes(24).toString('hex');
    const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId }, select: { orgId: true } });

    await prisma.auditLog.create({
      data: {
        orgId: space.orgId,
        userId,
        action: 'page.share',
        entityType: 'page-share',
        entityId: token,
        newData: { pageId, spaceId, token, createdAt: new Date().toISOString() },
        ipAddress: null,
        userAgent: null
      }
    });

    return { shareToken: token, url: `/api/spaces/shared/${token}` };
  },

  async getShared(token: string) {
    const row = await prisma.auditLog.findFirst({ where: { action: 'page.share', entityType: 'page-share', entityId: token }, orderBy: { createdAt: 'desc' } });
    const pageId = (row?.newData as any)?.pageId;
    if (!pageId) throw new AppError(404, 'PAGE_NOT_FOUND', 'Shared page not found');

    const page = await prisma.page.findFirst({
      where: { id: pageId, isArchived: false },
      include: { space: { select: { id: true, name: true, key: true } }, updatedBy: { select: { id: true, name: true, email: true } } }
    });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Shared page not found');
    return page;
  },

  async getCollabState(spaceId: string, pageId: string, userId: string) {
    await assertPageAccess(spaceId, pageId, userId, 'VIEW');

    const page = await prisma.page.findFirst({
      where: { id: pageId, spaceId, isArchived: false },
      select: { id: true, title: true, version: true, updatedAt: true, updatedBy: { select: { id: true, name: true, email: true } } }
    });

    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');

    let presence: any[] = [];
    const client = await redis();
    if (client) {
      try {
        const raw = await client.hgetall(`page:presence:${pageId}`);
        presence = Object.values(raw).map((v) => JSON.parse(v));
        await client.quit();
      } catch {
        // Presence is best-effort.
      }
    }

    return { page, presence, protocol: 'socket.io-presence-baseline', autosave: true };
  },

  async touchPresence(spaceId: string, pageId: string, user: { id: string; name: string; email: string }) {
    await assertPageAccess(spaceId, pageId, user.id, 'VIEW');

    const entry = { userId: user.id, name: user.name, email: user.email, at: new Date().toISOString() };
    const client = await redis();

    if (client) {
      try {
        await client.hset(`page:presence:${pageId}`, user.id, JSON.stringify(entry));
        await client.expire(`page:presence:${pageId}`, 120);
        await client.quit();
      } catch {
        // best effort only
      }
    }

    emitToSpace(spaceId, 'page:presence', { pageId, user: entry });
    return entry;
  },

  async exportPdf(pageId: string) {
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');

    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Inter,Arial,sans-serif;padding:40px;line-height:1.6}</style></head><body><h1>${page.title}</h1>${page.content}</body></html>`;
    try {
      const { default: puppeteer } = await import('puppeteer');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      const tab = await browser.newPage();
      await tab.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await tab.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      return pdf;
    } catch {
      return minimalPdf(page.title, htmlToText(page.content));
    }
  },

  async exportDocx(pageId: string) {
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');
    return Buffer.from(`# ${page.title}\n\n${htmlToText(page.content)}`, 'utf8');
  }
};
