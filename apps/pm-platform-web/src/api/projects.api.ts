import { api, unwrap } from './client';
import type { Project } from '@/types';

export const projectsApi = {
  list: () => api.get('/projects').then(unwrap<Project[]>),
  create: (body: Partial<Project> & Record<string, unknown>) => api.post('/projects', body).then(unwrap<Project>),
  get: (id: string) => api.get(`/projects/${id}`).then(unwrap<Project>),
  update: (id: string, body: Partial<Project> & Record<string, unknown>) => api.patch(`/projects/${id}`, body).then(unwrap<Project>),
  invite: (id: string, body: { email: string; role: string }) => api.post(`/projects/${id}/invite`, body).then(unwrap<unknown>),
  members: (id: string) => api.get(`/projects/${id}/members`).then(unwrap<any[]>),
  updateMember: (id: string, userId: string, body: { role: string }) => api.patch(`/projects/${id}/members/${userId}`, body).then(unwrap<unknown>),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),

  workflows: (id: string) => api.get(`/projects/${id}/workflows`).then(unwrap<any[]>),
  createWorkflow: (id: string, body: { name: string; isDefault?: boolean }) => api.post(`/projects/${id}/workflows`, body).then(unwrap<any>),
  updateWorkflow: (id: string, workflowId: string, body: Record<string, unknown>) => api.patch(`/projects/${id}/workflows/${workflowId}`, body).then(unwrap<any>),
  createStatus: (id: string, workflowId: string, body: Record<string, unknown>) => api.post(`/projects/${id}/workflows/${workflowId}/statuses`, body).then(unwrap<any>),
  updateStatus: (id: string, workflowId: string, statusId: string, body: Record<string, unknown>) => api.patch(`/projects/${id}/workflows/${workflowId}/statuses/${statusId}`, body).then(unwrap<any>),
  createTransition: (id: string, workflowId: string, body: Record<string, unknown>) => api.post(`/projects/${id}/workflows/${workflowId}/transitions`, body).then(unwrap<any>),
  createGuard: (id: string, workflowId: string, transitionId: string, body: Record<string, unknown>) => api.post(`/projects/${id}/workflows/${workflowId}/transitions/${transitionId}/guards`, body).then(unwrap<any>),

  issueTypes: (id: string) => api.get(`/projects/${id}/issue-types`).then(unwrap<any[]>),
  createIssueType: (id: string, body: Record<string, unknown>) => api.post(`/projects/${id}/issue-types`, body).then(unwrap<any>),
  updateIssueType: (id: string, typeId: string, body: Record<string, unknown>) => api.patch(`/projects/${id}/issue-types/${typeId}`, body).then(unwrap<any>),
  deleteIssueType: (id: string, typeId: string) => api.delete(`/projects/${id}/issue-types/${typeId}`),

  customFields: (id: string) => api.get(`/projects/${id}/custom-fields`).then(unwrap<any[]>),
  createCustomField: (id: string, body: Record<string, unknown>) => api.post(`/projects/${id}/custom-fields`, body).then(unwrap<any>),
  updateCustomField: (id: string, fieldId: string, body: Record<string, unknown>) => api.patch(`/projects/${id}/custom-fields/${fieldId}`, body).then(unwrap<any>),
  deleteCustomField: (id: string, fieldId: string) => api.delete(`/projects/${id}/custom-fields/${fieldId}`),

  webhooks: (id: string) => api.get(`/projects/${id}/webhooks`).then(unwrap<any[]>),
  createWebhook: (id: string, body: Record<string, unknown>) => api.post(`/projects/${id}/webhooks`, body).then(unwrap<any>),
  updateWebhook: (id: string, webhookId: string, body: Record<string, unknown>) => api.patch(`/projects/${id}/webhooks/${webhookId}`, body).then(unwrap<any>),
  deleteWebhook: (id: string, webhookId: string) => api.delete(`/projects/${id}/webhooks/${webhookId}`),
  webhookDeliveries: (id: string, webhookId: string) => api.get(`/projects/${id}/webhooks/${webhookId}/deliveries`).then(unwrap<any[]>),
  testWebhook: (id: string, webhookId: string) => api.post(`/projects/${id}/webhooks/${webhookId}/test`).then(unwrap<any>),

  permissionSchemes: (id: string) => api.get(`/projects/${id}/permission-schemes`).then(unwrap<any>),
  createPermissionScheme: (id: string, body: Record<string, unknown>) => api.post(`/projects/${id}/permission-schemes`, body).then(unwrap<any>),
  applyPermissionScheme: (id: string, schemeId: string) => api.post(`/projects/${id}/permission-schemes/${schemeId}/apply`).then(unwrap<any>),
  roadmap: (id: string) => api.get(`/projects/${id}/roadmap`).then(unwrap<any>),
  rescheduleRoadmapIssue: (id: string, issueId: string, body: { startDate: string; endDate: string }) => api.patch(`/projects/${id}/roadmap/issues/${issueId}/reschedule`, body).then(unwrap<any>),
  linkGithubCommit: (id: string, body: Record<string, unknown>) => api.post(`/projects/${id}/github/commits`, body).then(unwrap<any>)
};
