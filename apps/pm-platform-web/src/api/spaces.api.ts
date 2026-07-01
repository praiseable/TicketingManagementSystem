import { api, unwrap } from './client';
import type { Space, SpaceMember } from '@/types';

export const spacesApi = {
  list: () => api.get('/spaces').then(unwrap<Space[]>),
  create: (body: Partial<Space>) => api.post('/spaces', body).then(unwrap<Space>),
  get: (spaceId: string) => api.get(`/spaces/${spaceId}`).then(unwrap<Space>),
  update: (spaceId: string, body: Partial<Space>) => api.patch(`/spaces/${spaceId}`, body).then(unwrap<Space>),
  remove: (spaceId: string) => api.delete(`/spaces/${spaceId}`),
  members: (spaceId: string) => api.get(`/spaces/${spaceId}/members`).then(unwrap<SpaceMember[]>),
  addMember: (spaceId: string, body: { email: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' }) => api.post(`/spaces/${spaceId}/members`, body).then(unwrap<SpaceMember>),
  updateMember: (spaceId: string, memberId: string, body: { role: 'OWNER' | 'EDITOR' | 'VIEWER' }) => api.patch(`/spaces/${spaceId}/members/${memberId}`, body).then(unwrap<SpaceMember>),
  removeMember: (spaceId: string, memberId: string) => api.delete(`/spaces/${spaceId}/members/${memberId}`)
};
