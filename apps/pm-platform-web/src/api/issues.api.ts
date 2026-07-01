import { api, unwrap, unwrapWithMeta } from './client';
import type { Issue } from '@/types';

export const issuesApi = {
  list: (projectId: string, params?: Record<string, unknown>) => api.get(`/projects/${projectId}/issues`, { params }).then(unwrapWithMeta<Issue[]>),
  create: (projectId: string, body: any) => api.post(`/projects/${projectId}/issues`, body).then(unwrap<Issue>),
  get: (projectId: string, issueId: string) => api.get(`/projects/${projectId}/issues/${issueId}`).then(unwrap<Issue>),
  update: (projectId: string, issueId: string, body: any) => api.patch(`/projects/${projectId}/issues/${issueId}`, body).then(unwrap<Issue>),
  remove: (projectId: string, issueId: string) => api.delete(`/projects/${projectId}/issues/${issueId}`),
  transition: (projectId: string, issueId: string, toStatusId: string, comment?: string) => api.post(`/projects/${projectId}/issues/${issueId}/transition`, { toStatusId, comment }).then(unwrap<Issue>),
  link: (projectId: string, issueId: string, body: { targetIssueId?: string; targetIssueKey?: string; type: string }) => api.post(`/projects/${projectId}/issues/${issueId}/link`, body).then(unwrap<unknown>),
  unlink: (projectId: string, issueId: string, linkId: string) => api.delete(`/projects/${projectId}/issues/${issueId}/link/${linkId}`),
  bulk: (projectId: string, body: { issueIds: string[]; action: string; value?: unknown }) => api.post(`/projects/${projectId}/issues/bulk`, body).then(unwrap<{ updated: number }>),
  swimlanes: (projectId: string, groupBy: 'assignee' | 'priority' | 'label' | 'status' = 'assignee') => api.get(`/projects/${projectId}/issues/swimlanes/summary`, { params: { groupBy } }).then(unwrap<any>),
  watch: (projectId: string, issueId: string) => api.post(`/projects/${projectId}/issues/${issueId}/watch`),
  unwatch: (projectId: string, issueId: string) => api.delete(`/projects/${projectId}/issues/${issueId}/watch`)
};
