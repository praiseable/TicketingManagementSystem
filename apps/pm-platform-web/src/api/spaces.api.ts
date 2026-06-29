import { api, unwrap } from './client';
import type { Space } from '@/types';
export const spacesApi = {
  list: () => api.get('/spaces').then(unwrap<Space[]>),
  create: (body: Partial<Space>) => api.post('/spaces', body).then(unwrap<Space>),
  get: (spaceId: string) => api.get(`/spaces/${spaceId}`).then(unwrap<Space>),
  update: (spaceId: string, body: Partial<Space>) => api.patch(`/spaces/${spaceId}`, body).then(unwrap<Space>)
};
