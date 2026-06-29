import { prisma } from '@pm-platform/db';
import { pagination, meta } from '../utils/paginate.js';

export const auditService = {
  async list(orgId: string, query: Record<string, unknown>) {
    const { page, limit, skip, take } = pagination(query);
    const where = {
      orgId,
      ...(query.userId ? { userId: String(query.userId) } : {}),
      ...(query.entity ? { entityType: String(query.entity) } : {}),
      ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: new Date(String(query.from)) } : {}), ...(query.to ? { lte: new Date(String(query.to)) } : {}) } } : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } }),
      prisma.auditLog.count({ where })
    ]);
    return { data, meta: meta(page, limit, total) };
  }
};
