import { api, unwrap } from './client';
import type { Sprint } from '@/types';
export const sprintsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/sprints`).then(unwrap<Sprint[]>),
  get: (projectId: string, sprintId: string) => api.get(`/projects/${projectId}/sprints/${sprintId}`).then(unwrap<Sprint>),
  create: (projectId: string, body: Partial<Sprint>) => api.post(`/projects/${projectId}/sprints`, body).then(unwrap<Sprint>),
  start: (projectId: string, sprintId: string) => api.post(`/projects/${projectId}/sprints/${sprintId}/start`).then(unwrap<Sprint>),
  complete: (projectId: string, sprintId: string, moveToSprintId?: string) => api.post(`/projects/${projectId}/sprints/${sprintId}/complete`, { moveToSprintId }).then(unwrap<{ sprint: Sprint; movedIssues: number }>),
  burndown: (projectId: string, sprintId: string) => api.get(`/projects/${projectId}/sprints/${sprintId}/burndown`).then(unwrap<{ date: string; remaining: number; ideal: number }[]>),
  velocity: (projectId: string) => api.get(`/projects/${projectId}/sprints/velocity`).then(unwrap<{ sprintId: string; name: string; committed: number; completed: number }[]>)
};
