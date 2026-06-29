import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '@/api/performance.api';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/auth.store';
export function useMyPerformance(params?: Record<string, unknown>) { const user = useAuthStore((s) => s.user); return useQuery({ queryKey: queryKeys.performance(user?.id ?? 'me', params), queryFn: () => performanceApi.me(params), enabled: Boolean(user), staleTime: 30_000 }); }
export function useTeamPerformance(params?: Record<string, unknown>) { return useQuery({ queryKey: ['performance', 'team', params], queryFn: () => performanceApi.team(params), staleTime: 30_000 }); }
