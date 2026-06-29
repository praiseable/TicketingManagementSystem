import { api, unwrap } from './client';
import type { Project } from '@/types';
export const projectsApi = {
  list: () => api.get('/projects').then(unwrap<Project[]>),
  create: (body: Partial<Project>) => api.post('/projects', body).then(unwrap<Project>),
  get: (id: string) => api.get(`/projects/${id}`).then(unwrap<Project>),
  update: (id: string, body: Partial<Project>) => api.patch(`/projects/${id}`, body).then(unwrap<Project>),
  members: (id: string) => api.get(`/projects/${id}/members`).then(unwrap<unknown[]>),
  workflows: (id: string) => api.get(`/projects/${id}/workflows`).then(unwrap<unknown[]>),
  issueTypes: (id: string) => api.get(`/projects/${id}/issue-types`).then(unwrap<unknown[]>),
  customFields: (id: string) => api.get(`/projects/${id}/custom-fields`).then(unwrap<unknown[]>)
};
