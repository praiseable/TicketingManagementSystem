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
  collabState: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}/collab/state`).then(unwrap<unknown>),
  collabPresence: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/collab/presence`, {}).then(unwrap<unknown>),
  share: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/share`, {}).then(unwrap<{ shareToken: string }>),
  exportPdf: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/export/pdf`, {}, { responseType: 'blob' }),
  exportDocx: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/export/docx`, {}, { responseType: 'blob' })
};
