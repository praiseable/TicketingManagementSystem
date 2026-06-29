import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/api/auth.api';
import type { Tokens, User } from '@/types';

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; orgName?: string }) => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => void;
  setAuth: (user: User, tokens: Tokens) => void;
  syncMe: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      setAuth: (user, tokens) => set({ user, tokens, isAuthenticated: true }),
      login: async (email, password) => {
        const payload = await authApi.login({ email, password });
        set({ user: payload.user, tokens: payload.tokens, isAuthenticated: true });
      },
      register: async (payload) => {
        const auth = await authApi.register(payload);
        set({ user: auth.user, tokens: auth.tokens, isAuthenticated: true });
      },
      refreshAccessToken: async () => {
        const currentTokens = get().tokens;
        const refreshToken = currentTokens?.refreshToken;
        if (!refreshToken) return null;
        try {
          const next = await authApi.refresh(refreshToken);
          set((state) => ({
            tokens: state.tokens ? { ...state.tokens, accessToken: next.accessToken, refreshToken: next.refreshToken ?? state.tokens.refreshToken } : null
          }));
          return next.accessToken;
        } catch {
          get().logout();
          return null;
        }
      },
      syncMe: async () => {
        try {
          const { user } = await authApi.me();
          set({ user, isAuthenticated: true });
          return user;
        } catch {
          get().logout();
          return null;
        }
      },
      logout: () => {
        const token = get().tokens?.refreshToken;
        if (token) void authApi.logout(token).catch(() => undefined);
        set({ user: null, tokens: null, isAuthenticated: false });
      }
    }),
    { name: 'pm-platform-auth' }
  )
);
