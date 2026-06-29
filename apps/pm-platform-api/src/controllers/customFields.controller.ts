import { prisma } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

function stringParam(value: unknown): string {
  if (Array.isArray(value)) return stringParam(value[0]);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new AppError(400, 'PARAM_REQUIRED', 'Required route parameter is missing');
}

function slugKey(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || `field_${Date.now()}`;
}

function normalizeOptions(options: unknown) {
  if (options == null) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'string') {
    return options.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return options;
}

async function nextPosition(projectId: string) {
  const last = await prisma.customField.findFirst({ where: { projectId }, orderBy: { position: 'desc' } });
  return (last?.position ?? 0) + 100;
}

async function syncIssueTypeLayout(customFieldId: string, issueTypeIds: string[] | undefined, projectId: string) {
  if (!Array.isArray(issueTypeIds)) return;
  const validTypes = await prisma.issueType.findMany({ where: { projectId, id: { in: issueTypeIds } }, select: { id: true } });
  const validIds = validTypes.map((x) => x.id);
  await prisma.issueTypeField.deleteMany({ where: { customFieldId, issueType: { projectId } } });
  if (!validIds.length) return;
  await prisma.issueTypeField.createMany({
    data: validIds.map((issueTypeId, index) => ({ issueTypeId, customFieldId, position: index * 100 }))
  });
}

export const customFieldsController = {
  list: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const fields = await prisma.customField.findMany({
      where: { projectId },
      include: { issueTypeFields: { include: { issueType: true }, orderBy: { position: 'asc' } }, _count: { select: { values: true, guards: true } } },
      orderBy: { position: 'asc' }
    });
    ok(res, fields);
  }),

  create: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const body = req.body ?? {};
    const key = slugKey(body.key || body.name);
    const field = await prisma.customField.create({
      data: {
        projectId,
        name: body.name,
        key,
        type: body.type,
        options: normalizeOptions(body.options),
        isRequired: Boolean(body.isRequired),
        position: body.position ?? await nextPosition(projectId)
      }
    });
    await syncIssueTypeLayout(field.id, body.issueTypeIds, projectId);
    const full = await prisma.customField.findUniqueOrThrow({ where: { id: field.id }, include: { issueTypeFields: { include: { issueType: true } } } });
    created(res, full);
  }),

  update: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const fieldId = stringParam(req.params.fId);
    const current = await prisma.customField.findFirst({ where: { id: fieldId, projectId } });
    if (!current) throw new AppError(404, 'CUSTOM_FIELD_NOT_FOUND', 'Custom field not found');
    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    for (const key of ['name', 'type', 'isRequired', 'position']) if (key in body) data[key] = body[key];
    if ('key' in body && body.key) data.key = slugKey(body.key);
    if ('options' in body) data.options = normalizeOptions(body.options);
    await prisma.customField.update({ where: { id: fieldId }, data });
    await syncIssueTypeLayout(fieldId, body.issueTypeIds, projectId);
    const full = await prisma.customField.findUniqueOrThrow({ where: { id: fieldId }, include: { issueTypeFields: { include: { issueType: true } }, _count: { select: { values: true, guards: true } } } });
    ok(res, full);
  }),

  remove: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.id ?? req.params.projectId);
    const fieldId = stringParam(req.params.fId);
    const field = await prisma.customField.findFirst({ where: { id: fieldId, projectId }, include: { _count: { select: { values: true, guards: true } } } });
    if (!field) throw new AppError(404, 'CUSTOM_FIELD_NOT_FOUND', 'Custom field not found');
    if (field._count.values > 0) throw new AppError(409, 'CUSTOM_FIELD_IN_USE', 'Custom field has issue values and cannot be deleted');
    if (field._count.guards > 0) throw new AppError(409, 'CUSTOM_FIELD_IN_GUARD', 'Custom field is used by a workflow guard');
    await prisma.customField.delete({ where: { id: fieldId } });
    noContent(res);
  })
};
