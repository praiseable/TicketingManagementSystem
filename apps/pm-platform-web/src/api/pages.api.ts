import { api, unwrap } from './client';
import type { Page, PageVersion } from '@/types';

export const pagesApi = {
  tree: (spaceId: string) => api.get(`/spaces/${spaceId}/pages`).then(unwrap<Page[]>),
  create: (spaceId: string, body: Partial<Page> & { template?: string }) => api.post(`/spaces/${spaceId}/pages`, body).then(unwrap<Page>),
  get: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}`).then(unwrap<Page>),
  update: (spaceId: string, pageId: string, body: Partial<Page>) => api.patch(`/spaces/${spaceId}/pages/${pageId}`, body).then(unwrap<Page>),
  remove: (spaceId: string, pageId: string) => api.delete(`/spaces/${spaceId}/pages/${pageId}`),
  versions: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}/versions`).then(unwrap<PageVersion[]>),
  restore: (spaceId: string, pageId: string, version: number) => api.post(`/spaces/${spaceId}/pages/${pageId}/restore/${version}`, {}).then(unwrap<Page>),
  restrictions: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}/restrictions`).then(unwrap<any[]>),
  createRestriction: (spaceId: string, pageId: string, body: { type: 'VIEW' | 'EDIT'; role?: string | null; userId?: string | null }) => api.post(`/spaces/${spaceId}/pages/${pageId}/restrictions`, body).then(unwrap<any>),
  deleteRestriction: (spaceId: string, pageId: string, restrictionId: string) => api.delete(`/spaces/${spaceId}/pages/${pageId}/restrictions/${restrictionId}`),
  comments: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}/comments`).then(unwrap<any[]>),
  createComment: (spaceId: string, pageId: string, body: { body: string; selectionStart?: number | null; selectionEnd?: number | null }) => api.post(`/spaces/${spaceId}/pages/${pageId}/comments`, body).then(unwrap<any>),
  resolveComment: (spaceId: string, pageId: string, commentId: string) => api.patch(`/spaces/${spaceId}/pages/${pageId}/comments/${commentId}/resolve`, {}).then(unwrap<any>),
  embedIssue: (spaceId: string, pageId: string, body: { issueId?: string; issueKey?: string }) => api.post(`/spaces/${spaceId}/pages/${pageId}/embed-issue`, body).then(unwrap<any>),
  collabState: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}/collab/state`).then(unwrap<unknown>),
  collabPresence: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/collab/presence`, {}).then(unwrap<unknown>),
  share: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/share`, {}).then(unwrap<{ shareToken: string; url: string }>),
  shared: (token: string) => api.get(`/spaces/shared/${token}`).then(unwrap<Page>),
  exportPdf: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/export/pdf`, {}, { responseType: 'blob' }),
  exportDocx: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/export/docx`, {}, { responseType: 'blob' })
};
