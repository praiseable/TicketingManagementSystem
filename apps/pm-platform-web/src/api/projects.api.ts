import { api, unwrap } from './client';
import type { Project, ProjectMember, ProjectRole } from '@/types';

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string | null;
  iconUrl?: string | null;
}

export interface InviteProjectMemberInput {
  email: string;
  role: ProjectRole;
}

export const projectsApi = {
  list: () => api.get('/projects').then(unwrap<Project[]>),
  create: (body: CreateProjectInput) => api.post('/projects', body).then(unwrap<Project>),
  get: (id: string) => api.get(`/projects/${id}`).then(unwrap<Project>),
  update: (id: string, body: Partial<Project>) => api.patch(`/projects/${id}`, body).then(unwrap<Project>),
  remove: (id: string) => api.delete(`/projects/${id}`).then(() => undefined),
  invite: (id: string, body: InviteProjectMemberInput) => api.post(`/projects/${id}/invite`, body).then(unwrap<{ invitation: unknown; existingUserAdded: boolean; membership?: ProjectMember } >),
  members: (id: string) => api.get(`/projects/${id}/members`).then(unwrap<ProjectMember[]>),
  updateMember: (projectId: string, userId: string, role: ProjectRole) => api.patch(`/projects/${projectId}/members/${userId}`, { role }).then(unwrap<ProjectMember>),
  removeMember: (projectId: string, userId: string) => api.delete(`/projects/${projectId}/members/${userId}`).then(() => undefined),
  workflows: (id: string) => api.get(`/projects/${id}/workflows`).then(unwrap<unknown[]>),
  issueTypes: (id: string) => api.get(`/projects/${id}/issue-types`).then(unwrap<unknown[]>),
  customFields: (id: string) => api.get(`/projects/${id}/custom-fields`).then(unwrap<unknown[]>)
};
