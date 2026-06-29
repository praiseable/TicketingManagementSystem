export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  issues: (projectId: string, filters?: unknown) => ['issues', projectId, filters] as const,
  issue: (id: string) => ['issue', id] as const,
  workflows: (projectId: string) => ['workflows', projectId] as const,
  sprints: (projectId: string) => ['sprints', projectId] as const,
  worklogs: (issueId: string) => ['worklogs', issueId] as const,
  performance: (userId: string, params?: unknown) => ['performance', userId, params] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  spaces: ['spaces'] as const,
  pages: (spaceId: string) => ['pages', spaceId] as const,
  page: (pageId: string) => ['page', pageId] as const,
  search: (q: string) => ['search', q] as const
};
