import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { worklogsApi } from '@/api/worklogs.api';
import { queryKeys } from '@/api/queryKeys';
import type { Worklog } from '@/types';

function invalidateIssueTime(qc: ReturnType<typeof useQueryClient>, issueId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.worklogs(issueId) });
  qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
}

export function useWorklogs(issueId: string) {
  return useQuery({ queryKey: queryKeys.worklogs(issueId), queryFn: () => worklogsApi.list(issueId), enabled: Boolean(issueId) });
}

export function useCreateWorklog(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Worklog>) => worklogsApi.create(issueId, body),
    onSettled: () => invalidateIssueTime(qc, issueId)
  });
}

export function useUpdateWorklog(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ worklogId, body }: { worklogId: string; body: Partial<Worklog> }) => worklogsApi.update(issueId, worklogId, body),
    onSettled: () => invalidateIssueTime(qc, issueId)
  });
}

export function useDeleteWorklog(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (worklogId: string) => worklogsApi.remove(issueId, worklogId),
    onSettled: () => invalidateIssueTime(qc, issueId)
  });
}
