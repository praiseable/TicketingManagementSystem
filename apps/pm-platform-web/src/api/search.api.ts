import { api, unwrap } from './client';

export const searchApi = {
  global: (q: string, params?: Record<string, unknown>) => api.get('/search', { params: { q, ...params } }).then(unwrap<{ issues: unknown[]; pages: unknown[]; projects: unknown[] }>),
  issues: (q: string, filters?: Record<string, unknown>, params?: Record<string, unknown>) => api.get('/search/issues', { params: { q, filters: JSON.stringify(filters ?? {}), ...params } }).then(unwrap<unknown[]>),
  saveFilter: (body: { name: string; projectId?: string; filters: Record<string, unknown>; jql?: string }) => api.post('/search/filters/save', body).then(unwrap<unknown>),
  filters: (params?: Record<string, unknown>) => api.get('/search/filters', { params }).then(unwrap<unknown[]>),
  deleteFilter: (id: string) => api.delete(`/search/filters/${id}`)
};
