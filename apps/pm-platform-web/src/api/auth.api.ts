import { api, unwrap } from './client';
import type { AuthPayload, User } from '@/types';

export interface RegisterResponse extends AuthPayload {
  verification?: {
    emailSent: boolean;
    expiresInHours: number;
    devToken?: string;
  };
}

export const authApi = {
  register: (body: { name: string; email: string; password: string; orgName?: string }) =>
    api.post('/auth/register', body).then(unwrap<RegisterResponse>),
  login: (body: { email: string; password: string }) => api.post('/auth/login', body).then(unwrap<AuthPayload>),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }).then(unwrap<{ accessToken: string; refreshToken?: string }>),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (body: { token: string; password: string }) => api.post('/auth/reset-password', body),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  me: () => api.get('/auth/me').then(unwrap<{ user: User }>)
};
