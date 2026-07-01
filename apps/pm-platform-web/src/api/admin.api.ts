import { api, unwrap, unwrapWithMeta } from './client';

export type AdminUserFilters = { page?: number; limit?: number; q?: string; role?: string; isActive?: string };
export type AuditFilters = { page?: number; limit?: number; q?: string; userId?: string; action?: string; entityType?: string; entityId?: string; from?: string; to?: string };

function params(filters: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== null && String(value).trim() !== '') out[key] = String(value);
  return out;
}

export const adminApi = {
  stats: () => api.get('/admin/stats').then(unwrap<any>),
  users: (filters: AdminUserFilters = {}) => api.get('/admin/users', { params: params(filters) }).then(unwrapWithMeta<any[]>),
  activateUser: (id: string) => api.patch(`/admin/users/${id}/activate`).then(unwrap<any>),
  deactivateUser: (id: string) => api.patch(`/admin/users/${id}/deactivate`).then(unwrap<any>),
  changeUserRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }).then(unwrap<any>),
  resetUserPassword: (id: string, password?: string) => api.patch(`/admin/users/${id}/password`, password ? { password } : {}).then(unwrap<any>),
  auditLog: (filters: AuditFilters = {}) => api.get('/admin/audit-log', { params: params(filters) }).then(unwrapWithMeta<any[]>)
};
