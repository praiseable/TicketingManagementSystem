import { api, unwrap } from './client';

export const integrationsApi = {
  ssoConfig: () => api.get('/auth/sso/config').then(unwrap<any>),
  updateSsoConfig: (body: Record<string, unknown>) => api.put('/auth/sso/config', body).then(unwrap<any>),
  ssoLoginUrl: (params: { orgId?: string; slug?: string }) => api.get('/auth/sso/login-url', { params }).then(unwrap<any>)
};
