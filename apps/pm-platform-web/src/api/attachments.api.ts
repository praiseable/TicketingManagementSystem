import { api, unwrap } from './client';
import type { Attachment } from '@/types';

export const attachmentsApi = {
  list: (issueId: string) => api.get(`/issues/${issueId}/attachments`).then(unwrap<Attachment[]>),
  upload: (issueId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/issues/${issueId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap<Attachment>);
  },
  url: (issueId: string, attachmentId: string) => api.get(`/issues/${issueId}/attachments/${attachmentId}/url`).then(unwrap<{ url: string }>),
  remove: (issueId: string, attachmentId: string) => api.delete(`/issues/${issueId}/attachments/${attachmentId}`)
};
