import { prisma } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

function stringParam(value: unknown): string {
  if (Array.isArray(value)) return stringParam(value[0]);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new AppError(400, 'PARAM_REQUIRED', 'Required route parameter is missing');
}

async function nextPosition(projectId: string) {
  const last = await prisma.issueType.findFirst({ where: { projectId }, orderBy: { position: 'desc' } });
  return (last?.position ?? 0) + 100;
}

async function syncCustomFieldLayout(issueTypeId: string, customFieldIds: string[] | undefined, projectId: string) {
  if (!Array.isArray(customFieldIds)) return;
  const valid = await prisma.customField.findMany({ where: { projectId, id: { in: customFieldIds } }, select: { id: true } });
  const validIds = valid.map((x) => x.id);
  await prisma.issueTypeField.deleteMany({ where: { issueTypeId } });
  if (!validIds.length) return;
  await prisma.issueTypeField.createMany({ data: validIds.map((customFieldId, index) => ({ issueTypeId, customFieldId, position: index * 100 })) });
}

export const issueTypesController = {
  list: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const types = await prisma.issueType.findMany({
      where: { projectId },
      include: { fields: { include: { customField: true }, orderBy: { position: 'asc' } }, _count: { select: { issues: true } } },
      orderBy: { position: 'asc' }
    });
    ok(res, types);
  }),

  create: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const body = req.body ?? {};
    const issueType = await prisma.issueType.create({
      data: {
        projectId,
        name: body.name,
        color: body.color ?? '#64748b',
        icon: body.icon ?? 'circle',
        isDefault: Boolean(body.isDefault),
        position: body.position ?? await nextPosition(projectId)
      }
    });
    await syncCustomFieldLayout(issueType.id, body.customFieldIds, projectId);
    const full = await prisma.issueType.findUniqueOrThrow({ where: { id: issueType.id }, include: { fields: { include: { customField: true } } } });
    created(res, full);
  }),

  update: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const typeId = stringParam(req.params.typeId);
    const existing = await prisma.issueType.findFirst({ where: { id: typeId, projectId } });
    if (!existing) throw new AppError(404, 'ISSUE_TYPE_NOT_FOUND', 'Issue type not found');
    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    for (const key of ['name', 'color', 'icon', 'isDefault', 'position']) if (key in body) data[key] = body[key];
    await prisma.issueType.update({ where: { id: typeId }, data });
    await syncCustomFieldLayout(typeId, body.customFieldIds, projectId);
    const full = await prisma.issueType.findUniqueOrThrow({ where: { id: typeId }, include: { fields: { include: { customField: true } }, _count: { select: { issues: true } } } });
    ok(res, full);
  }),

  remove: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const typeId = stringParam(req.params.typeId);
    const issueType = await prisma.issueType.findFirst({ where: { id: typeId, projectId }, include: { _count: { select: { issues: true } } } });
    if (!issueType) throw new AppError(404, 'ISSUE_TYPE_NOT_FOUND', 'Issue type not found');
    if (issueType._count.issues > 0) throw new AppError(409, 'ISSUE_TYPE_IN_USE', 'Issue type has issues and cannot be deleted');
    const count = await prisma.issueType.count({ where: { projectId } });
    if (count <= 1) throw new AppError(409, 'LAST_ISSUE_TYPE', 'At least one issue type is required');
    await prisma.issueType.delete({ where: { id: typeId } });
    noContent(res);
  })
};
