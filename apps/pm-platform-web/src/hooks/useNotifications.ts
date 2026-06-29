import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications.api';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/auth.store';
export function useNotifications() { const user = useAuthStore((s) => s.user); return useQuery({ queryKey: queryKeys.notifications(user?.id ?? 'me'), queryFn: () => notificationsApi.list(), enabled: Boolean(user), staleTime: 0 }); }
export function useReadAllNotifications() { const qc = useQueryClient(); return useMutation({ mutationFn: notificationsApi.readAll, onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }) }); }
