import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.PRISMA_QUERY_LOG === 'true'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const GlobalRole = { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const;
export type GlobalRole = (typeof GlobalRole)[keyof typeof GlobalRole];
export const ProjectRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER', VIEWER: 'VIEWER' } as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];
export const SpaceRole = { OWNER: 'OWNER', EDITOR: 'EDITOR', VIEWER: 'VIEWER' } as const;
export type SpaceRole = (typeof SpaceRole)[keyof typeof SpaceRole];
export const FieldType = { TEXT: 'TEXT', TEXTAREA: 'TEXTAREA', NUMBER: 'NUMBER', DATE: 'DATE', DATETIME: 'DATETIME', DROPDOWN: 'DROPDOWN', MULTISELECT: 'MULTISELECT', USER: 'USER', CHECKBOX: 'CHECKBOX', URL: 'URL' } as const;
export type FieldType = (typeof FieldType)[keyof typeof FieldType];
export const StatusCategory = { TODO: 'TODO', IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE' } as const;
export type StatusCategory = (typeof StatusCategory)[keyof typeof StatusCategory];
export const GuardType = { REQUIRED_FIELD: 'REQUIRED_FIELD', ASSIGNEE_SET: 'ASSIGNEE_SET', PERMISSION: 'PERMISSION' } as const;
export type GuardType = (typeof GuardType)[keyof typeof GuardType];
export const PostFnType = { AUTO_ASSIGN: 'AUTO_ASSIGN', AUTO_LABEL: 'AUTO_LABEL', AUTO_NOTIFY: 'AUTO_NOTIFY', SET_FIELD: 'SET_FIELD', MOVE_TO_SPRINT: 'MOVE_TO_SPRINT' } as const;
export type PostFnType = (typeof PostFnType)[keyof typeof PostFnType];
export const Priority = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'NONE' } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
export const LinkType = { BLOCKS: 'BLOCKS', BLOCKED_BY: 'BLOCKED_BY', DUPLICATES: 'DUPLICATES', DUPLICATED_BY: 'DUPLICATED_BY', RELATES_TO: 'RELATES_TO', CLONES: 'CLONES' } as const;
export type LinkType = (typeof LinkType)[keyof typeof LinkType];
export const SprintStatus = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' } as const;
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];
export const VersionStatus = { UNRELEASED: 'UNRELEASED', RELEASED: 'RELEASED', ARCHIVED: 'ARCHIVED' } as const;
export type VersionStatus = (typeof VersionStatus)[keyof typeof VersionStatus];
export const TimerStatus = { ACTIVE: 'ACTIVE', PAUSED: 'PAUSED' } as const;
export type TimerStatus = (typeof TimerStatus)[keyof typeof TimerStatus];
export const PeriodType = { DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY', SPRINT: 'SPRINT', QUARTERLY: 'QUARTERLY' } as const;
export type PeriodType = (typeof PeriodType)[keyof typeof PeriodType];
export const NotificationType = { ISSUE_ASSIGNED: 'ISSUE_ASSIGNED', ISSUE_UPDATED: 'ISSUE_UPDATED', ISSUE_COMMENTED: 'ISSUE_COMMENTED', ISSUE_MENTIONED: 'ISSUE_MENTIONED', SPRINT_STARTED: 'SPRINT_STARTED', SPRINT_COMPLETED: 'SPRINT_COMPLETED', PAGE_UPDATED: 'PAGE_UPDATED', PAGE_MENTIONED: 'PAGE_MENTIONED' } as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
export const SpaceType = { TEAM: 'TEAM', PROJECT: 'PROJECT', PERSONAL: 'PERSONAL' } as const;
export type SpaceType = (typeof SpaceType)[keyof typeof SpaceType];
export const RestrictionType = { VIEW: 'VIEW', EDIT: 'EDIT' } as const;
export type RestrictionType = (typeof RestrictionType)[keyof typeof RestrictionType];

export * from '@prisma/client';
export { redis, createRedisConnection } from './redis.js';
export { meili, bootstrapMeilisearch } from './meilisearch.js';
export { minio, bootstrapBuckets } from './minio.js';
export default prisma;
