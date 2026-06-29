import { api, unwrap } from './client';
import type { Comment } from '@/types';

export const commentsApi = {
  list: (issueId: string) => api.get(`/issues/${issueId}/comments`).then(unwrap<Comment[]>),
  create: (issueId: string, body: { body: string; parentId?: string | null }) => api.post(`/issues/${issueId}/comments`, body).then(unwrap<Comment>),
  update: (issueId: string, commentId: string, body: { body: string }) => api.patch(`/issues/${issueId}/comments/${commentId}`, body).then(unwrap<Comment>),
  remove: (issueId: string, commentId: string) => api.delete(`/issues/${issueId}/comments/${commentId}`)
};
