import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuid } from 'uuid';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse } from '@/types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Request-ID'] = uuid();
  return config;
});

let refreshing: Promise<string | null> | null = null;

function shouldSkipRefresh(url?: string) {
  return Boolean(url && ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'].some((path) => url.includes(path)));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !shouldSkipRefresh(original.url)) {
      original._retry = true;
      refreshing ??= useAuthStore.getState().refreshAccessToken().finally(() => { refreshing = null; });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function unwrap<T>(response: { data: ApiResponse<T> }) {
  if (!response.data.success) throw new Error(response.data.error?.message ?? 'API request failed');
  return response.data.data as T;
}

export function unwrapWithMeta<T>(response: { data: ApiResponse<T> }) {
  if (!response.data.success) throw new Error(response.data.error?.message ?? 'API request failed');
  return { data: response.data.data as T, meta: response.data.meta };
}
