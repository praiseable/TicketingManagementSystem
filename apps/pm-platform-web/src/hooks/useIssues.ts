import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '../api/issues.api';
import { queryKeys } from '../api/queryKeys';

export function useIssues(projectId?: string, filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.issues(projectId ?? '', filters),
    queryFn: () => issuesApi.list(projectId!, filters),
    enabled: Boolean(projectId)
  });
}

export function useIssue(projectId?: string, issueId?: string) {
  return useQuery({
    queryKey: queryKeys.issue(issueId ?? ''),
    queryFn: () => issuesApi.get(projectId!, issueId!),
    enabled: Boolean(projectId && issueId)
  });
}

export function useIssueMutations(projectId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['issues'] });

  return {
    create: useMutation({ mutationFn: (data: any) => issuesApi.create(projectId, data), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ issueId, data }: { issueId: string; data: any }) => issuesApi.update(projectId, issueId, data), onSuccess: invalidate }),
    transition: useMutation({ mutationFn: ({ issueId, toStatusId }: { issueId: string; toStatusId: string }) => issuesApi.transition(projectId, issueId, toStatusId), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (issueId: string) => issuesApi.remove(projectId, issueId), onSuccess: invalidate })
  };
}


export function useUpdateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: any }) => issuesApi.update(projectId, issueId, body),
    onSuccess: (issue: any) => {
      if (issue?.id) qc.setQueryData(queryKeys.issue(issue.id), issue);
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
    }
  });
}
