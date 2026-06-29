import { api, unwrap } from './client';
import type { Worklog } from '@/types';
export const worklogsApi = {
  list: (issueId: string) => api.get(`/issues/${issueId}/worklogs`).then(unwrap<Worklog[]>),
  create: (issueId: string, body: Partial<Worklog>) => api.post(`/issues/${issueId}/worklogs`, body).then(unwrap<Worklog>),
  update: (issueId: string, worklogId: string, body: Partial<Worklog>) => api.patch(`/issues/${issueId}/worklogs/${worklogId}`, body).then(unwrap<Worklog>),
  remove: (issueId: string, worklogId: string) => api.delete(`/issues/${issueId}/worklogs/${worklogId}`)
};
