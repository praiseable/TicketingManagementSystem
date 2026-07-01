import { api, unwrap } from './client';
import type { MyPerformanceResponse, TeamPerformanceResponse, TimeReportResponse } from '@/types';

export const performanceApi = {
  me: (params?: Record<string, unknown>) => api.get('/performance/me', { params }).then(unwrap<MyPerformanceResponse>),
  team: (params?: Record<string, unknown>) => api.get('/performance/team', { params }).then(unwrap<TeamPerformanceResponse>),
  timeReport: (params?: Record<string, unknown>) => api.get('/performance/reports/time', { params }).then(unwrap<TimeReportResponse>),
  exportTime: (params?: Record<string, unknown>) => api.get('/performance/reports/time/export', { params, responseType: 'blob' })
};
