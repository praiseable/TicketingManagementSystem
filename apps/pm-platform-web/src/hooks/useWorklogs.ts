import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { worklogsApi } from '@/api/worklogs.api';
import { queryKeys } from '@/api/queryKeys';
export function useWorklogs(issueId: string) { return useQuery({ queryKey: queryKeys.worklogs(issueId), queryFn: () => worklogsApi.list(issueId), enabled: Boolean(issueId) }); }
export function useCreateWorklog(issueId: string) { const qc = useQueryClient(); return useMutation({ mutationFn: (body: any) => worklogsApi.create(issueId, body), onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.worklogs(issueId) }) }); }
