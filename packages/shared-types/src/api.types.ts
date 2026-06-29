export type ID = string;
export type ISODate = string;

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: ApiErrorBody;
}

export type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type SpaceRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type SprintStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TimerStatus = 'ACTIVE' | 'PAUSED';
export type NotificationType =
  | 'ISSUE_ASSIGNED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_COMMENTED'
  | 'ISSUE_MENTIONED'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'PAGE_UPDATED'
  | 'PAGE_MENTIONED';

export interface UserSummary {
  id: ID;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role?: GlobalRole;
}

export interface Organization {
  id: ID;
  name: string;
  slug: string;
  logoUrl?: string | null;
  settings: Record<string, unknown>;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Project {
  id: ID;
  orgId: ID;
  name: string;
  key: string;
  description?: string | null;
  iconUrl?: string | null;
  lead?: UserSummary | null;
  isArchived: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface IssueType {
  id: ID;
  projectId: ID;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  position: number;
}

export interface WorkflowStatus {
  id: ID;
  workflowId: ID;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
  wipLimit?: number | null;
}

export interface Label {
  id: ID;
  projectId: ID;
  name: string;
  color: string;
}

export interface CustomFieldValue {
  id: ID;
  customFieldId: ID;
  value: string | null;
}

export interface IssueSummary {
  id: ID;
  key: string;
  title: string;
  priority: Priority;
  workflowStatus?: WorkflowStatus;
}

export interface Issue {
  id: ID;
  key: string;
  number: number;
  projectId: ID;
  issueType: IssueType;
  workflowStatus: WorkflowStatus;
  title: string;
  description: string | null;
  priority: Priority;
  reporter: UserSummary;
  assignee: UserSummary | null;
  parent: IssueSummary | null;
  storyPoints: number | null;
  originalEstimate: number | null;
  remainingEstimate: number | null;
  timeLogged: number;
  labels: Label[];
  customFieldValues: CustomFieldValue[];
  attachmentCount: number;
  commentCount: number;
  watcherCount: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Comment {
  id: ID;
  issueId: ID;
  user: UserSummary;
  body: string;
  parentId?: ID | null;
  isEdited: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Worklog {
  id: ID;
  issueId: ID;
  user: UserSummary;
  timeSpent: number;
  dateStarted: ISODate;
  description?: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TimerSession {
  id?: ID;
  issueId: ID;
  userId: ID;
  startedAt: ISODate;
  accumulatedSeconds: number;
  status: TimerStatus;
}

export interface Sprint {
  id: ID;
  projectId: ID;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  startDate: ISODate;
  endDate: ISODate;
  completedAt?: ISODate | null;
}

export interface PerformanceSnapshot {
  id: ID;
  userId: ID;
  projectId?: ID | null;
  periodType: string;
  periodKey: string;
  issuesAssigned: number;
  issuesCompleted: number;
  issuesCreated: number;
  timeLoggedSeconds: number;
  onTimePct: number;
  storyPointsDelivered: number;
  avgResolutionSeconds?: number | null;
  estimateAccuracyPct?: number | null;
  bugRate?: number | null;
  reopenRate?: number | null;
}

export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: ISODate;
}

export interface Space {
  id: ID;
  orgId: ID;
  type: 'TEAM' | 'PROJECT' | 'PERSONAL';
  name: string;
  key: string;
  description?: string | null;
  iconUrl?: string | null;
  isArchived: boolean;
}

export interface Page {
  id: ID;
  spaceId: ID;
  parentId?: ID | null;
  title: string;
  slug: string;
  content: string;
  contentJson: unknown;
  version: number;
  publishedAt?: ISODate | null;
  isArchived: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthPayload {
  user: UserSummary & { orgId: ID; isActive: boolean };
  tokens: Tokens;
}

export interface Paginated<T> {
  data: T[];
  meta: ApiMeta;
}
