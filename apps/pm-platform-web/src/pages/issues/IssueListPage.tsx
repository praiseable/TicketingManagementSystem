import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchInput } from '@/components/search/SearchInput';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { BulkActionBar } from '@/components/issues/BulkActionBar';
import { useIssues } from '@/hooks/useIssues';
import { projectsApi } from '@/api/projects.api';
import { issuesApi } from '@/api/issues.api';
import { Button } from '@/components/ui/button';

export function IssueListPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const { data, isLoading, error } = useIssues(id, { search: q, limit: 500 });
  const members = useQuery({ queryKey: ['project-members', id], queryFn: () => projectsApi.members(id), enabled: Boolean(id) });
  const workflows = useQuery({ queryKey: ['workflows', id], queryFn: () => projectsApi.workflows(id), enabled: Boolean(id) });
  const bulk = useMutation({
    mutationFn: ({ action, value }: { action: string; value?: unknown }) => issuesApi.bulk(id, { issueIds: selected, action, value }),
    onSuccess: () => { setSelected([]); qc.invalidateQueries({ queryKey: ['issues'] }); }
  });

  const issues = data?.data ?? [];
  const statuses = useMemo(() => (workflows.data ?? []).flatMap((wf: any) => wf.statuses ?? []), [workflows.data]);
  const allSelected = issues.length > 0 && selected.length === issues.length;

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
        <p className="text-sm text-muted-foreground">Filter, select, and bulk update issues for UC-22.</p>
      </div>
      <Button asChild><Link to={`/projects/${id}/board`}>Open board</Link></Button>
    </div>
    <SearchInput value={q} onChange={setQ} />
    {isLoading && <div>Loading issues…</div>}
    {error && <div className="rounded-lg border border-destructive p-4 text-destructive">Failed to load issues.</div>}
    <div className="rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-3"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? issues.map((i) => i.id) : [])} /></th><th className="p-3 text-left">Key</th><th className="p-3 text-left">Title</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Assignee</th><th className="p-3 text-left">Priority</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id} className="border-b hover:bg-muted/40"><td className="p-3"><input type="checkbox" checked={selected.includes(issue.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...new Set([...s, issue.id])] : s.filter((x) => x !== issue.id))} /></td><td className="p-3 font-medium"><Link to={`/projects/${id}/issues/${issue.id}`}>{issue.key}</Link></td><td className="p-3">{issue.title}</td><td className="p-3"><StatusBadge status={issue.workflowStatus} /></td><td className="p-3">{issue.assignee?.name ?? 'Unassigned'}</td><td className="p-3"><PriorityBadge priority={issue.priority} /></td></tr>)}</tbody></table></div>
    <BulkActionBar count={selected.length} onClear={() => setSelected([])} onApply={(action, value) => bulk.mutate({ action, value })} statuses={statuses} members={members.data ?? []} />
  </div>;
}
