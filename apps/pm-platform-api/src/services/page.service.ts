import { createRedisConnection, prisma, SpaceRole } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { emitToSpace } from '../sockets/index.js';

const templateContent: Record<string, string> = {
  blank: '<p>Start writing…</p>',
  requirements: '<h1>Requirements</h1><h2>Overview</h2><p>Describe the problem, users, assumptions, and acceptance criteria.</p><h2>Acceptance Criteria</h2><ul><li>Criterion 1</li><li>Criterion 2</li></ul>',
  meeting: '<h1>Meeting Notes</h1><h2>Agenda</h2><ul><li>Topic</li></ul><h2>Decisions</h2><ul><li>Decision</li></ul><h2>Actions</h2><ul><li>Owner — Action — Due date</li></ul>',
  retrospective: '<h1>Retrospective</h1><h2>Went well</h2><ul><li>Item</li></ul><h2>Could improve</h2><ul><li>Item</li></ul><h2>Actions</h2><ul><li>Action</li></ul>',
  adr: '<h1>Architecture Decision Record</h1><h2>Context</h2><p>Describe context.</p><h2>Decision</h2><p>Describe decision.</p><h2>Consequences</h2><p>Describe consequences.</p>'
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
      where: {
        spaceId,
        slug,
        ...(excludePageId ? { id: { not: excludePageId } } : {})
      },
      select: { id: true }
    });

    if (!existing) return slug;
    slug = `${base}-${n++}`;
  }
}

async function assertSpaceMember(spaceId: string, userId: string, roles?: SpaceRole[]) {
  const space = await prisma.space.findFirst({
    where: { id: spaceId, isArchived: false },
    include: { members: true }
  });

  if (!space) throw new AppError(404, 'SPACE_NOT_FOUND', 'Space not found');

  const member = space.members.find((m) => m.userId === userId);
  if (!member) throw new AppError(403, 'SPACE_FORBIDDEN', 'You are not a member of this space');

  if (roles?.length && !roles.includes(member.role)) {
    throw new AppError(403, 'SPACE_FORBIDDEN', 'Insufficient space permission');
  }

  return { space, member };
}

async function redis() {
  try {
    return createRedisConnection();
  } catch {
    return null;
  }
}

export const pageService = {
  assertSpaceMember,

  async create(spaceId: string, userId: string, input: any) {
    await assertSpaceMember(spaceId, userId, [SpaceRole.OWNER, SpaceRole.EDITOR]);

    const slug = await uniqueSlug(spaceId, input.title);
    const content = input.content ?? templateContent[input.template ?? 'blank'] ?? templateContent.blank;
    const contentJson = input.contentJson ?? { type: 'doc', content: [] };

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

      await tx.pageVersion.create({
        data: {
          pageId: page.id,
          version: page.version,
          content: page.content,
          contentJson: (page.contentJson ?? {}) as any,
          createdById: userId
        }
      });

      await tx.auditLog.create({
        data: {
          orgId: (await tx.space.findUniqueOrThrow({ where: { id: spaceId }, select: { orgId: true } })).orgId,
          userId,
          action: 'page.create',
          entityType: 'page',
          entityId: page.id,
          newData: { title: page.title, version: page.version },
          ipAddress: null,
          userAgent: null
        }
      });

      return page;
    });
  },

  async update(spaceId: string, pageId: string, userId: string, input: any) {
    await assertSpaceMember(spaceId, userId, [SpaceRole.OWNER, SpaceRole.EDITOR]);

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
        create: {
          pageId,
          version: nextVersion,
          content: changed.content,
          contentJson: (changed.contentJson ?? {}) as any,
          createdById: userId
        },
        update: {
          content: changed.content,
          contentJson: (changed.contentJson ?? {}) as any,
          createdById: userId
        }
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
    await assertSpaceMember(spaceId, userId, [SpaceRole.OWNER, SpaceRole.EDITOR]);

    const old = await prisma.pageVersion.findUnique({ where: { pageId_version: { pageId, version } } });
    if (!old) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');

    const page = await this.update(spaceId, pageId, userId, {
      content: old.content,
      contentJson: old.contentJson ?? {}
    });

    emitToSpace(spaceId, 'page:restored', { pageId, restoredFromVersion: version, page });
    return page;
  },

  async getCollabState(spaceId: string, pageId: string, userId: string) {
    await assertSpaceMember(spaceId, userId);

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
        // Presence is best-effort and must not break editing.
      }
    }

    return { page, presence, protocol: 'socket.io-presence-baseline', autosave: true };
  },

  async touchPresence(spaceId: string, pageId: string, user: { id: string; name: string; email: string }) {
    await assertSpaceMember(spaceId, user.id);

    const page = await prisma.page.findFirst({ where: { id: pageId, spaceId, isArchived: false }, select: { id: true } });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');

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
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const tab = await browser.newPage();
    await tab.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await tab.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdf;
  },

  async exportDocx(pageId: string) {
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');
    return Buffer.from(`# ${page.title}\n\n${page.content.replace(/<[^>]+>/g, '')}`, 'utf8');
  }
};
