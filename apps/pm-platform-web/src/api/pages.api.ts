import { api, unwrap } from './client';
import type { Page } from '@/types';
export const pagesApi = {
  tree: (spaceId: string) => api.get(`/spaces/${spaceId}/pages`).then(unwrap<Page[]>),
  create: (spaceId: string, body: Partial<Page>) => api.post(`/spaces/${spaceId}/pages`, body).then(unwrap<Page>),
  get: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}`).then(unwrap<Page>),
  update: (spaceId: string, pageId: string, body: Partial<Page>) => api.patch(`/spaces/${spaceId}/pages/${pageId}`, body).then(unwrap<Page>),
  versions: (spaceId: string, pageId: string) => api.get(`/spaces/${spaceId}/pages/${pageId}/versions`).then(unwrap<unknown[]>),
  exportPdf: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/export/pdf`, {}, { responseType: 'blob' }),
  exportDocx: (spaceId: string, pageId: string) => api.post(`/spaces/${spaceId}/pages/${pageId}/export/docx`, {}, { responseType: 'blob' })
};
