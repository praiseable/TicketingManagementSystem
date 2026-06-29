import { prisma } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'page';
}

export const pageService = {
  async create(spaceId: string, userId: string, input: any) {
    const slug = slugify(input.title);
    return prisma.page.create({ data: { spaceId, title: input.title, slug, parentId: input.parentId ?? null, content: input.content ?? '', contentJson: input.contentJson ?? {}, createdById: userId, updatedById: userId, publishedAt: new Date() } });
  },
  async update(spaceId: string, pageId: string, userId: string, input: any) {
    const page = await prisma.page.findFirst({ where: { id: pageId, spaceId } });
    if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page not found');
    return prisma.$transaction(async (tx) => {
      await tx.pageVersion.create({ data: { pageId, version: page.version, content: page.content, contentJson: (page.contentJson ?? {}) as any, createdById: userId } });
      return tx.page.update({ where: { id: pageId }, data: { title: input.title ?? page.title, slug: input.title ? slugify(input.title) : page.slug, content: input.content ?? page.content, contentJson: (input.contentJson ?? page.contentJson ?? {}) as any, parentId: input.parentId === undefined ? page.parentId : input.parentId, publishedAt: input.publishedAt ? new Date(input.publishedAt) : page.publishedAt, version: { increment: 1 }, updatedById: userId } });
    });
  },
  async restore(spaceId: string, pageId: string, version: number, userId: string) {
    const old = await prisma.pageVersion.findUnique({ where: { pageId_version: { pageId, version } } });
    if (!old) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');
    return this.update(spaceId, pageId, userId, { content: old.content, contentJson: old.contentJson ?? {} });
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
