import { api, unwrap } from './client';
import type { Issue } from '@/types';

export const backlogApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/backlog`).then(unwrap<Issue[]>),
  reorder: (projectId: string, issueId: string, newPosition: number) => api.patch(`/projects/${projectId}/backlog/reorder`, { issueId, newPosition }),
  moveToSprint: (projectId: string, issueIds: string[], sprintId?: string | null) => api.post(`/projects/${projectId}/backlog/move-to-sprint`, { issueIds, sprintId: sprintId ?? null })
};
