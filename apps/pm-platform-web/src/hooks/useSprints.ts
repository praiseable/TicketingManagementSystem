import { useQuery } from '@tanstack/react-query';
import { sprintsApi } from '@/api/sprints.api';
import { queryKeys } from '@/api/queryKeys';
export function useSprints(projectId: string) { return useQuery({ queryKey: queryKeys.sprints(projectId), queryFn: () => sprintsApi.list(projectId), enabled: Boolean(projectId), staleTime: 30_000 }); }
