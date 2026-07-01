import { prisma } from '@pm-platform/db';
import { meta, pagination } from '../utils/paginate.js';

type QueryLike = Record<string, unknown>;

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) value = value[0];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseDate(value: unknown, endOfDay = false): Date | undefined {
  const raw = firstString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  else date.setUTCHours(0, 0, 0, 0);
  return date;
}

export const auditService = {
  async list(orgId: string, query: QueryLike) {
    const { page, limit, skip, take } = pagination(query);
    const userId = firstString(query.userId);
    const action = firstString(query.action);
    const entityType = firstString(query.entityType) ?? firstString(query.entity);
    const entityId = firstString(query.entityId);
    const q = firstString(query.q);
    const from = parseDate(query.from);
    const to = parseDate(query.to, true);

    const where: any = {
      orgId,
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(entityType ? { entityType: { contains: entityType, mode: 'insensitive' } } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    };

    if (q) {
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return { data, meta: meta(page, limit, total) };
  },

  async record(input: {
    orgId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldData?: unknown;
    newData?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldData: (input.oldData ?? null) as any,
        newData: (input.newData ?? null) as any,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null
      }
    });
  }
};
