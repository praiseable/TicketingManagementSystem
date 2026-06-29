import { api, unwrap, unwrapWithMeta } from './client';
import type { Notification } from '@/types';

export const notificationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }).then(unwrapWithMeta<Notification[]>),
  read: (id: string) => api.patch(`/notifications/${id}/read`),
  readAll: () => api.patch('/notifications/read-all'),
  prefs: () => api.get('/notifications/preferences').then(unwrap<unknown[]>),
  updatePrefs: (prefs: unknown[]) => api.patch('/notifications/preferences', { prefs }).then(unwrap<unknown[]>)
};
