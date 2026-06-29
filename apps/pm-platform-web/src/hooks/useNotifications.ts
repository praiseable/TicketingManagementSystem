import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications.api';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/auth.store';

export function useNotifications(params: Record<string, unknown> = {}) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [...queryKeys.notifications(user?.id ?? 'me'), params],
    queryFn: () => notificationsApi.list(params),
    enabled: Boolean(user),
    staleTime: 0
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.read(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] })
  });
}

export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.readAll,
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] })
  });
}

export function useNotificationPrefs() {
  return useQuery({ queryKey: ['notification-prefs'], queryFn: notificationsApi.prefs });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.updatePrefs,
    onSettled: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] })
  });
}
