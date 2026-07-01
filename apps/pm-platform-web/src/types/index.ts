export type ID = string;
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';

export interface ApiResponse<T> { success: boolean; data?: T; meta?: { page: number; limit: number; total: number; totalPages: number }; error?: { code: string; message: string; details?: unknown } }
export interface User { id: ID; orgId?: ID; email: string; name: string; avatarUrl?: string | null; role?: GlobalRole; isActive?: boolean }
export interface Tokens { accessToken: string; refreshToken: string }
export interface AuthPayload { user: User; tokens: Tokens }
export interface Project { id: ID; orgId: ID; name: string; key: string; description?: string | null; iconUrl?: string | null; lead?: User; leadId?: ID; settings?: Record<string, unknown>; isArchived?: boolean; currentUserRole?: ProjectRole | null; members?: ProjectMember[]; issueTypes?: IssueType[]; customFields?: unknown[]; workflows?: Workflow[]; invitations?: Invitation[]; _count?: { issues: number; members: number; invitations?: number } }
export interface IssueType { id: ID; projectId: ID; name: string; color: string; icon: string; isDefault: boolean; position: number }
export interface WorkflowStatus { id: ID; workflowId: ID; name: string; color: string; category: StatusCategory; position: number; wipLimit?: number | null }
export interface Workflow { id: ID; projectId: ID; name: string; isDefault: boolean; statuses: WorkflowStatus[]; transitions?: WorkflowTransition[] }
export interface WorkflowTransition { id: ID; fromStatusId: ID; toStatusId: ID; name: string }
export interface Label { id: ID; name: string; color: string }
export interface Issue { id: ID; key: string; number: number; projectId: ID; issueType: IssueType; workflowStatus: WorkflowStatus; workflowStatusId?: ID; title: string; description?: string | null; priority: Priority; reporter?: User; assignee?: User | null; assigneeId?: ID | null; parentId?: ID | null; sprintId?: ID | null; storyPoints?: number | null; originalEstimate?: number | null; remainingEstimate?: number | null; dueDate?: string | null; resolvedAt?: string | null; labels?: { label: Label }[] | Label[]; customFieldValues?: { id: ID; customFieldId: ID; value?: string | null }[]; comments?: Comment[]; attachments?: Attachment[]; histories?: IssueHistory[]; worklogs?: Worklog[]; parent?: Issue | null; children?: Issue[]; watchers?: { id: ID; userId: ID; user?: User }[]; sourceLinks?: IssueLink[]; targetLinks?: IssueLink[]; _count?: { comments: number; attachments: number; watchers: number; children?: number }; createdAt: string; updatedAt: string; position?: number }

export interface IssueLink { id: ID; type: string; sourceIssueId: ID; targetIssueId: ID; sourceIssue?: Issue; targetIssue?: Issue; createdBy?: User; createdAt: string }
export interface Comment { id: ID; issueId: ID; user: User; body: string; parentId?: ID | null; isEdited: boolean; createdAt: string; updatedAt: string; replies?: Comment[] }
export interface Attachment { id: ID; issueId?: ID | null; filename: string; mimeType: string; sizeBytes: number; bucketKey: string; createdAt: string; user?: User }
export interface Worklog { id: ID; issueId: ID; user?: User; issue?: { id: ID; key: string; title: string; projectId: ID }; timeSpent: number; dateStarted: string; description?: string | null; createdAt?: string; updatedAt?: string }
export interface TimerSession { issueId: ID; userId: ID; startedAt: string; accumulatedSeconds: number; elapsedSeconds?: number; status: 'ACTIVE' | 'PAUSED'; issue?: { id: ID; key: string; title: string; projectId: ID } }
export interface Sprint { id: ID; projectId: ID; name: string; goal?: string | null; capacity?: number | null; status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; startDate: string; endDate: string; completedAt?: string | null; issues?: Issue[]; committedStoryPoints?: number; completedStoryPoints?: number; _count?: { issues?: number; sprintIssues?: number } }
export interface PerformanceSnapshot { id: ID; userId: ID; projectId?: ID | null; periodType: string; periodKey: string; issuesAssigned: number; issuesCompleted: number; issuesCreated: number; timeLoggedSeconds: number; onTimePct: number; storyPointsDelivered: number; estimateAccuracyPct?: number | null }
export interface Notification { id: ID; type: string; title: string; body: string; entityType: string; entityId: string; isRead: boolean; createdAt: string }
export interface Space { id: ID; orgId: ID; type: 'TEAM' | 'PROJECT' | 'PERSONAL'; name: string; key: string; description?: string | null; iconUrl?: string | null; owner?: User; members?: SpaceMember[]; _count?: { pages: number } }
export interface Page { id: ID; spaceId: ID; parentId?: ID | null; title: string; slug: string; content: string; contentJson: unknown; version: number; isArchived: boolean; createdAt: string; updatedAt: string; comments?: unknown[]; versions?: PageVersion[]; createdBy?: User; updatedBy?: User; _count?: { children?: number; comments?: number; versions?: number } }
export interface IssueHistory { id: ID; field: string; oldValue?: string | null; newValue?: string | null; user?: User; createdAt: string }


export interface ProjectMember { id: ID; projectId: ID; userId: ID; role: ProjectRole; createdAt?: string; user?: User }
export interface Invitation { id: ID; orgId: ID; projectId?: ID | null; email: string; role: ProjectRole; expiresAt: string; acceptedAt?: string | null; devToken?: string }


export interface PerformanceSummary {
  issuesAssigned: number;
  issuesCompleted: number;
  issuesCreated: number;
  timeLoggedSeconds: number;
  hoursLogged: number;
  onTimePct: number;
  storyPointsDelivered: number;
  estimateAccuracyPct?: number | null;
  avgResolutionSeconds?: number | null;
  bugRate?: number | null;
  worklogCount?: number;
}

export interface PerformanceActivity {
  type: string;
  action: string;
  issue?: { id: ID; key: string; title: string; projectId: ID };
  at: string;
  detail?: string | null;
  seconds?: number;
}

export interface DailyTimeRow { date: string; seconds: number; hours: number }

export interface MyPerformanceResponse {
  user: Pick<User, 'id' | 'email' | 'name'>;
  range: { period: string; periodType: string; periodKey: string; from: string; to: string };
  projectIds: ID[];
  summary: PerformanceSummary;
  dailyTime: DailyTimeRow[];
  recentActivity: PerformanceActivity[];
  snapshot?: PerformanceSnapshot | null;
  snapshots?: PerformanceSnapshot[];
}

export interface TeamPerformanceRow {
  user: User;
  projectRole: ProjectRole;
  summary: PerformanceSummary;
  dailyTime: DailyTimeRow[];
}

export interface TeamPerformanceResponse {
  project?: { id: ID; key: string; name: string } | null;
  range: { period: string; periodType: string; periodKey: string; from: string; to: string };
  rows: TeamPerformanceRow[];
  totals: PerformanceSummary & { members: number };
}

export interface TimeReportGroup { key: string; label: string; timeSpent: number; hours: number; worklogCount: number }
export interface TimeReportRow {
  id: ID;
  user: User;
  project: { id: ID; key: string; name: string };
  issue: { id: ID; key: string; title: string };
  issueType: { id: ID; name: string };
  timeSpent: number;
  hours: number;
  dateStarted: string;
  description?: string | null;
}
export interface TimeReportResponse {
  range: { period: string; periodType: string; periodKey: string; from: string; to: string };
  filters: { projectId?: string | null; userId?: string | null; groupBy: string };
  summary: { worklogCount: number; timeLoggedSeconds: number; hoursLogged: number };
  grouped: TimeReportGroup[];
  rows: TimeReportRow[];
}

export interface SpaceMember { id: ID; spaceId: ID; userId: ID; role: 'OWNER' | 'EDITOR' | 'VIEWER'; user?: User; createdAt?: string }
export interface PageVersion { id: ID; pageId: ID; version: number; content: string; contentJson: unknown; createdBy?: User; createdAt: string }
