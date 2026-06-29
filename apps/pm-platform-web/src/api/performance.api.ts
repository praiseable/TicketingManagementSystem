import { api, unwrap } from './client';
import type { PerformanceSnapshot, Worklog } from '@/types';
export const performanceApi = {
  me: (params?: Record<string, unknown>) => api.get('/performance/me', { params }).then(unwrap<PerformanceSnapshot[]>),
  team: (params?: Record<string, unknown>) => api.get('/performance/team', { params }).then(unwrap<PerformanceSnapshot[]>),
  timeReport: (params?: Record<string, unknown>) => api.get('/performance/reports/time', { params }).then(unwrap<Worklog[]>),
  exportTime: (params?: Record<string, unknown>) => api.get('/performance/reports/time/export', { params, responseType: 'blob' })
};
