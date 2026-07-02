import { prisma, GuardType, PostFnType, NotificationType, ProjectRole } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { emitToProject } from '../sockets/index.js';
import { webhookService } from './webhook.service.js';
import { notificationService } from './notification.service.js';

const roleRank: Record<ProjectRole, number> = {
  [ProjectRole.VIEWER]: 1,
  [ProjectRole.MEMBER]: 2,
  [ProjectRole.ADMIN]: 3,
  [ProjectRole.OWNER]: 4
};

type TransitionWithRules = Awaited<ReturnType<typeof findTransitionWithRules>>;

async function findTransitionWithRules(
  client: typeof prisma,
  fromStatusId: string,
  toStatusId: string
) {
  return client.workflowTransition.findFirst({
    where: { fromStatusId, toStatusId },
    include: {
      guards: true,
      postFns: { orderBy: { position: 'asc' } }
    }
  });
}

async function assertSameWorkflow(
  client: typeof prisma,
  fromStatusId: string,
  toStatusId: string
) {
  const [fromStatus, toStatus] = await Promise.all([
    client.workflowStatus.findUnique({ where: { id: fromStatusId } }),
    client.workflowStatus.findUnique({ where: { id: toStatusId } })
  ]);

  if (!fromStatus) throw new AppError(422, 'FROM_STATUS_NOT_FOUND', 'Current workflow status was not found');
  if (!toStatus) throw new AppError(422, 'TO_STATUS_NOT_FOUND', 'Target workflow status was not found');
  if (fromStatus.workflowId !== toStatus.workflowId) {
    throw new AppError(422, 'CROSS_WORKFLOW_MOVE_BLOCKED', 'Issue cannot move to a status from a different workflow');
  }

  return { fromStatus, toStatus };
}

async function runGuards(
  client: typeof prisma,
  issue: { id: string; projectId: string; assigneeId: string | null; customFieldValues?: Array<{ customFieldId: string; value: string | null }> },
  guards: NonNullable<TransitionWithRules>['guards'],
  userId: string
) {
  for (const guard of guards) {
    if (guard.type === GuardType.ASSIGNEE_SET && !issue.assigneeId) {
      throw new AppError(422, 'GUARD_FAILED', 'Assignee is required');
    }

    if (guard.type === GuardType.REQUIRED_FIELD) {
      const config = guard.config as { field?: string };
      if (guard.fieldId) {
        let value = issue.customFieldValues?.find((item) => item.customFieldId === guard.fieldId)?.value;
        if (value === undefined) {
          const fieldValue = await client.customFieldValue.findUnique({
            where: { issueId_customFieldId: { issueId: issue.id, customFieldId: guard.fieldId } }
          });
          value = fieldValue?.value ?? undefined;
        }
        if (!value) throw new AppError(422, 'GUARD_FAILED', 'Required custom field is empty');
      } else if (config.field && !(issue as Record<string, unknown>)[config.field]) {
        throw new AppError(422, 'GUARD_FAILED', `${config.field} is required`);
      }
    }

    if (guard.type === GuardType.PERMISSION) {
      const config = guard.config as { minRole?: ProjectRole };
      const membership = await client.projectMember.findUnique({
        where: { projectId_userId: { projectId: issue.projectId, userId } }
      });
      const minRole = config.minRole ?? ProjectRole.MEMBER;
      if (!membership || roleRank[membership.role] < roleRank[minRole]) {
        throw new AppError(422, 'GUARD_FAILED', `Requires ${minRole} project role`);
      }
    }
  }
}

export const workflowService = {
  async canTransition(issueId: string, toStatusId: string, userId: string) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true, customFieldValues: true }
    });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

    if (issue.workflowStatusId === toStatusId) return { allowed: true };

    await assertSameWorkflow(prisma, issue.workflowStatusId, toStatusId);

    const transition = await findTransitionWithRules(prisma, issue.workflowStatusId, toStatusId);

    // Trello-style board mode: allow direct drag/drop between any statuses in the same workflow.
    // If an explicit transition exists, its guards/post-functions are applied. If not, this is
    // treated as a direct board move with history, realtime emit, and webhook event.
    if (!transition) return { allowed: true, reason: 'Direct board move allowed' };

    try {
      await runGuards(prisma, issue, transition.guards, userId);
      return { allowed: true };
    } catch (error) {
      if (error instanceof AppError) return { allowed: false, reason: error.message };
      throw error;
    }
  },

  async executeTransition(issueId: string, toStatusId: string, userId: string, comment?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const issue = await tx.issue.findUnique({
        where: { id: issueId },
        include: {
          workflowStatus: true,
          project: true,
          assignee: true,
          customFieldValues: true
        }
      });
      if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

      if (issue.workflowStatusId === toStatusId) {
        return tx.issue.findUniqueOrThrow({
          where: { id: issueId },
          include: { project: true, assignee: true, workflowStatus: true }
        });
      }

      const { toStatus } = await assertSameWorkflow(tx as typeof prisma, issue.workflowStatusId, toStatusId);
      const transition = await findTransitionWithRules(tx as typeof prisma, issue.workflowStatusId, toStatusId);

      if (transition) {
        await runGuards(tx as typeof prisma, issue, transition.guards, userId);
      }

      const updated = await tx.issue.update({
        where: { id: issueId },
        data: {
          workflowStatusId: toStatusId,
          resolvedAt: String(toStatus.category) === 'DONE' ? new Date() : null
        },
        include: {
          project: true,
          assignee: true,
          workflowStatus: true,
          issueType: true,
          labels: { include: { label: true } }
        }
      });

      await tx.issueHistory.create({
        data: {
          issueId,
          userId,
          field: 'workflowStatusId',
          oldValue: issue.workflowStatusId,
          newValue: toStatusId
        }
      });

      if (comment?.trim()) {
        await tx.comment.create({ data: { issueId, userId, body: comment.trim() } });
      }

      if (transition) {
        for (const fn of transition.postFns) {
          const config = fn.config as Record<string, string>;
          if (fn.type === PostFnType.AUTO_ASSIGN && config.userId) {
            await tx.issue.update({ where: { id: issueId }, data: { assigneeId: config.userId } });
          }

          if (fn.type === PostFnType.AUTO_LABEL && config.label) {
            const label = await tx.label.upsert({
              where: { projectId_name: { projectId: updated.projectId, name: config.label } },
              update: {},
              create: { projectId: updated.projectId, name: config.label, color: config.color ?? '#64748b' }
            });
            await tx.issueLabel.upsert({
              where: { issueId_labelId: { issueId, labelId: label.id } },
              update: {},
              create: { issueId, labelId: label.id }
            });
          }

          if (fn.type === PostFnType.SET_FIELD && config.field && config.value) {
            await tx.issue.update({ where: { id: issueId }, data: { [config.field]: config.value } as never });
            await tx.issueHistory.create({ data: { issueId, userId, field: `postfn.set_field.${config.field}`, oldValue: null, newValue: String(config.value ?? '') } });
          }

          if (fn.type === PostFnType.AUTO_NOTIFY) {
            const userIds = Array.isArray((config as any).userIds) ? (config as any).userIds : (config as any).userId ? [(config as any).userId] : [];
            for (const targetUserId of [...new Set(userIds.map(String).filter(Boolean))]) {
              await tx.notification.create({ data: { userId: targetUserId, type: NotificationType.ISSUE_UPDATED, title: (config as any).title || `${updated.key} workflow update`, body: (config as any).body || `${updated.title} triggered a workflow notification`, entityType: 'issue', entityId: issueId } });
            }
          }

          if (fn.type === PostFnType.MOVE_TO_SPRINT && (config as any).sprintId) {
            const sprintId = String((config as any).sprintId);
            const sprint = await tx.sprint.findFirst({ where: { id: sprintId, projectId: updated.projectId } });
            if (!sprint) throw new AppError(422, 'SPRINT_NOT_IN_PROJECT', 'Post-function sprint must belong to the issue project');
            await tx.issue.update({ where: { id: issueId }, data: { sprintId } });
            await tx.sprintIssue.upsert({ where: { sprintId_issueId: { sprintId, issueId } }, update: { completedInSprint: false }, create: { sprintId, issueId, completedInSprint: false } });
          }
        }
      }

      return tx.issue.findUniqueOrThrow({ where: { id: issueId }, include: { project: true, assignee: true, workflowStatus: true, issueType: true, labels: { include: { label: true } } } });
    });

    try {
      emitToProject(result.projectId, 'issue:transitioned', result);
    } catch (error) {
      console.warn('Failed to emit issue transition event', error);
    }

    try {
      if (result.assigneeId) {
        await notificationService.notify(
          result.assigneeId,
          NotificationType.ISSUE_UPDATED,
          `${result.key} transitioned`,
          `${result.title} moved to ${result.workflowStatus.name}`,
          'issue',
          result.id
        );
      }
    } catch (error) {
      console.warn('Failed to create transition notification', error);
    }

    try {
      await webhookService.queueProjectEvent(result.projectId, 'issue.transitioned', result);
    } catch (error) {
      console.warn('Failed to queue transition webhook', error);
    }

    return result;
  }
};
