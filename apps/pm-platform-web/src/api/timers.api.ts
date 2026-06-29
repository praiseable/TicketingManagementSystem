import { api, unwrap } from './client';
import type { TimerSession, Worklog } from '@/types';
export const timersApi = {
  active: () => api.get('/timers/active').then(unwrap<TimerSession[]>),
  start: (issueId: string) => api.post('/timers/start', { issueId }).then(unwrap<TimerSession>),
  pause: (issueId: string) => api.post('/timers/pause', { issueId }).then(unwrap<TimerSession>),
  stop: (issueId: string) => api.post('/timers/stop', { issueId }).then(unwrap<Worklog>)
};
