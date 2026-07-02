import { prisma, StatusCategory } from '@pm-platform/db';
import { asyncHandler, created, noContent, ok, AppError } from '../utils/apiResponse.js';

function stringParam(value: unknown): string {
  if (Array.isArray(value)) return stringParam(value[0]);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new AppError(400, 'PARAM_REQUIRED', 'Required route parameter is missing');
}

async function nextStatusPosition(workflowId: string) {
  const last = await prisma.workflowStatus.findFirst({ where: { workflowId }, orderBy: { position: 'desc' } });
  return (last?.position ?? 0) + 100;
}

async function assertWorkflow(projectId: string, workflowId: string) {
  const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, projectId } });
  if (!workflow) throw new AppError(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
  return workflow;
}

async function assertStatus(workflowId: string, statusId: string) {
  const status = await prisma.workflowStatus.findFirst({ where: { id: statusId, workflowId } });
  if (!status) throw new AppError(422, 'STATUS_NOT_IN_WORKFLOW', 'Workflow status does not belong to this workflow');
  return status;
}

export const workflowsController = {
  list: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const workflows = await prisma.workflow.findMany({
      where: { projectId },
      include: {
        statuses: { orderBy: { position: 'asc' } },
        transitions: { include: { fromStatus: true, toStatus: true, guards: { include: { field: true } }, postFns: { orderBy: { position: 'asc' } } } }
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    ok(res, workflows);
  }),

  create: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const body = req.body ?? {};
    if (body.isDefault) await prisma.workflow.updateMany({ where: { projectId }, data: { isDefault: false } });
    const workflow = await prisma.workflow.create({ data: { projectId, name: body.name, isDefault: Boolean(body.isDefault) } });
    created(res, await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id }, include: { statuses: true, transitions: true } }));
  }),

  get: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    await assertWorkflow(projectId, wfId);
    ok(res, await prisma.workflow.findUnique({ where: { id: wfId }, include: { statuses: { orderBy: { position: 'asc' } }, transitions: { include: { fromStatus: true, toStatus: true, guards: { include: { field: true } }, postFns: { orderBy: { position: 'asc' } } } } } }));
  }),

  update: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    await assertWorkflow(projectId, wfId);
    if (req.body?.isDefault) await prisma.workflow.updateMany({ where: { projectId, id: { not: wfId } }, data: { isDefault: false } });
    ok(res, await prisma.workflow.update({ where: { id: wfId }, data: req.body }));
  }),

  remove: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const workflow = await assertWorkflow(projectId, wfId);
    const statuses = await prisma.workflowStatus.findMany({ where: { workflowId: wfId }, select: { id: true } });
    const used = await prisma.issue.count({ where: { projectId, workflowStatusId: { in: statuses.map((s) => s.id) } } });
    if (used > 0) throw new AppError(409, 'WORKFLOW_IN_USE', 'Workflow has issues and cannot be deleted');
    if (workflow.isDefault) throw new AppError(409, 'DEFAULT_WORKFLOW', 'Default workflow cannot be deleted');
    await prisma.workflow.delete({ where: { id: wfId } });
    noContent(res);
  }),

  createStatus: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    await assertWorkflow(projectId, wfId);
    const status = await prisma.workflowStatus.create({ data: { workflowId: wfId, name: req.body.name, color: req.body.color ?? '#64748b', category: req.body.category ?? StatusCategory.TODO, position: req.body.position ?? await nextStatusPosition(wfId), wipLimit: req.body.wipLimit ?? null } });
    created(res, status);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const sId = stringParam(req.params.sId);
    await assertWorkflow(projectId, wfId);
    await assertStatus(wfId, sId);
    ok(res, await prisma.workflowStatus.update({ where: { id: sId }, data: req.body }));
  }),

  removeStatus: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const sId = stringParam(req.params.sId);
    await assertWorkflow(projectId, wfId);
    await assertStatus(wfId, sId);
    const issueCount = await prisma.issue.count({ where: { workflowStatusId: sId } });
    if (issueCount > 0) throw new AppError(409, 'STATUS_IN_USE', 'Status has issues and cannot be deleted');
    const transitionCount = await prisma.workflowTransition.count({ where: { workflowId: wfId, OR: [{ fromStatusId: sId }, { toStatusId: sId }] } });
    if (transitionCount > 0) throw new AppError(409, 'STATUS_HAS_TRANSITIONS', 'Remove transitions before deleting this status');
    await prisma.workflowStatus.delete({ where: { id: sId } });
    noContent(res);
  }),

  createTransition: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    await assertWorkflow(projectId, wfId);
    await assertStatus(wfId, req.body.fromStatusId);
    await assertStatus(wfId, req.body.toStatusId);
    const transition = await prisma.workflowTransition.upsert({
      where: { workflowId_fromStatusId_toStatusId: { workflowId: wfId, fromStatusId: req.body.fromStatusId, toStatusId: req.body.toStatusId } },
      update: { name: req.body.name },
      create: { workflowId: wfId, fromStatusId: req.body.fromStatusId, toStatusId: req.body.toStatusId, name: req.body.name },
      include: { fromStatus: true, toStatus: true, guards: { include: { field: true } }, postFns: true }
    });
    created(res, transition);
  }),

  updateTransition: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const tId = stringParam(req.params.tId);
    await assertWorkflow(projectId, wfId);
    const transition = await prisma.workflowTransition.findFirst({ where: { id: tId, workflowId: wfId } });
    if (!transition) throw new AppError(404, 'TRANSITION_NOT_FOUND', 'Transition not found');
    ok(res, await prisma.workflowTransition.update({ where: { id: tId }, data: req.body }));
  }),

  removeTransition: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const tId = stringParam(req.params.tId);
    await assertWorkflow(projectId, wfId);
    await prisma.workflowTransition.delete({ where: { id: tId } });
    noContent(res);
  }),

  createGuard: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const tId = stringParam(req.params.tId);
    await assertWorkflow(projectId, wfId);
    const transition = await prisma.workflowTransition.findFirst({ where: { id: tId, workflowId: wfId } });
    if (!transition) throw new AppError(404, 'TRANSITION_NOT_FOUND', 'Transition not found');
    if (req.body.fieldId) {
      const field = await prisma.customField.findFirst({ where: { id: req.body.fieldId, projectId } });
      if (!field) throw new AppError(422, 'FIELD_NOT_IN_PROJECT', 'Guard custom field must belong to this project');
    }
    const guard = await prisma.transitionGuard.create({ data: { transitionId: tId, type: req.body.type, fieldId: req.body.fieldId ?? null, config: req.body.config ?? {} }, include: { field: true } });
    created(res, guard);
  }),

  removeGuard: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const gId = stringParam(req.params.gId);
    await assertWorkflow(projectId, wfId);
    const guard = await prisma.transitionGuard.findFirst({ where: { id: gId, transition: { workflowId: wfId } } });
    if (!guard) throw new AppError(404, 'GUARD_NOT_FOUND', 'Transition guard not found');
    await prisma.transitionGuard.delete({ where: { id: gId } });
    noContent(res);
  }),

  createPostFn: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const tId = stringParam(req.params.tId);
    await assertWorkflow(projectId, wfId);
    const transition = await prisma.workflowTransition.findFirst({ where: { id: tId, workflowId: wfId } });
    if (!transition) throw new AppError(404, 'TRANSITION_NOT_FOUND', 'Transition not found');
    const count = await prisma.transitionPostFn.count({ where: { transitionId: tId } });
    const postFn = await prisma.transitionPostFn.create({ data: { transitionId: tId, type: req.body.type, config: req.body.config ?? {}, position: req.body.position ?? (count + 1) * 100 } });
    created(res, postFn);
  }),

  removePostFn: asyncHandler(async (req, res) => {
    const projectId = stringParam(req.params.projectId ?? req.params.id);
    const wfId = stringParam(req.params.wfId);
    const pfId = stringParam(req.params.pfId);
    await assertWorkflow(projectId, wfId);
    const postFn = await prisma.transitionPostFn.findFirst({ where: { id: pfId, transition: { workflowId: wfId } } });
    if (!postFn) throw new AppError(404, 'POST_FUNCTION_NOT_FOUND', 'Transition post-function not found');
    await prisma.transitionPostFn.delete({ where: { id: pfId } });
    noContent(res);
  })
};
