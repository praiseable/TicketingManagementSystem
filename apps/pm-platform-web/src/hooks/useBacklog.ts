import { useQuery } from '@tanstack/react-query';
import { backlogApi } from '@/api/backlog.api';

export function useBacklog(projectId: string) {
  return useQuery({
    queryKey: ['backlog', projectId],
    queryFn: () => backlogApi.list(projectId),
    enabled: Boolean(projectId),
    staleTime: 15_000
  });
}
