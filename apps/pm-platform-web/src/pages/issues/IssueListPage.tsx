import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, Save, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { useIssues } from '@/hooks/useIssues';
import { issuesApi } from '@/api/issues.api';
import { projectsApi } from '@/api/projects.api';
import { searchApi } from '@/api/search.api';

const priorities = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

type Filters = {
  search: string;
  status: string;
  type: string;
  assignee: string;
  priority: string;
  label: string;
  createdFrom: string;
  createdTo: string;
};

const emptyFilters: Filters = {
  search: '', status: '', type: '', assignee: '', priority: '', label: '', createdFrom: '', createdTo: ''
};

function cleanFilters(filters: Filters): Record<string, unknown> {
  const params: Record<string, unknown> = { page: 1, limit: 500 };
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }
  return params;
}

export function IssueListPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [filterName, setFilterName] = useState('');
  const params = useMemo(() => cleanFilters(filters), [filters]);

  const { data, isLoading } = useIssues(id, params);
  const issueTypes = useQuery({ queryKey: ['issue-types', id], queryFn: () => projectsApi.issueTypes(id), enabled: Boolean(id) });
  const workflows = useQuery({ queryKey: ['workflows', id], queryFn: () => projectsApi.workflows(id), enabled: Boolean(id) });
  const members = useQuery({ queryKey: ['project-members', id], queryFn: () => projectsApi.members(id), enabled: Boolean(id) });
  const savedFilters = useQuery({ queryKey: ['saved-filters', id], queryFn: () => searchApi.filters({ projectId: id }), enabled: Boolean(id) });
  const issues = data?.data ?? [];
  const statuses = ((workflows.data as any[]) ?? []).flatMap((wf: any) => wf.statuses ?? []);
  const memberRows = ((members.data as any[]) ?? []).map((m: any) => ({ role: m.role, ...(m.user ?? m) }));

  const bulk = useMutation({
    mutationFn: (body: { action: string; value?: unknown }) => issuesApi.bulk(id, { issueIds: selected, ...body }),
    onSuccess: () => { setSelected([]); qc.invalidateQueries({ queryKey: ['issues'] }); }
  });

  const saveFilter = useMutation({
    mutationFn: () => searchApi.saveFilter({ name: filterName || `Filter ${new Date().toLocaleString()}`, projectId: id, filters: params }),
    onSuccess: () => { setFilterName(''); qc.invalidateQueries({ queryKey: ['saved-filters', id] }); }
  });

  const deleteFilter = useMutation({
    mutationFn: (filterId: string) => searchApi.deleteFilter(filterId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-filters', id] })
  });

  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const selectedAll = issues.length > 0 && selected.length === issues.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-sm text-muted-foreground">Filter issues by type, status, assignee, priority, label, date range, and saved views.</p>
        </div>
        <Badge variant="outline">{data?.meta?.total ?? issues.length} results</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search key, title, description" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} /></div>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">All statuses</option>{statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}><option value="">All issue types</option>{((issueTypes.data as any[]) ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.assignee} onChange={(e) => setFilter('assignee', e.target.value)}><option value="">All assignees</option>{memberRows.map((u: any) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}</select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>{priorities.map((p) => <option key={p || 'all'} value={p}>{p || 'All priorities'}</option>)}</select>
            <Input placeholder="Label" value={filters.label} onChange={(e) => setFilter('label', e.target.value)} />
            <Input type="date" value={filters.createdFrom} onChange={(e) => setFilter('createdFrom', e.target.value)} />
            <Input type="date" value={filters.createdTo} onChange={(e) => setFilter('createdTo', e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setFilters(emptyFilters)}>Clear filters</Button>
            <Input className="w-64" placeholder="Saved filter name" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
            <Button onClick={() => filterName.trim() ? saveFilter.mutate() : alert('Filter name is required')} disabled={saveFilter.isPending}><Save className="mr-1 h-4 w-4" /> Save filter</Button>
          </div>

          {!!((savedFilters.data as any[]) ?? []).length && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {((savedFilters.data as any[]) ?? []).map((sf: any) => (
                <span key={sf.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                  <button type="button" onClick={() => setFilters({ ...emptyFilters, ...(sf.filters ?? {}) })}>{sf.name}</button>
                  <button type="button" className="text-destructive" onClick={() => deleteFilter.mutate(sf.id)}><Trash2 className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!!selected.length && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm font-medium">{selected.length} selected</span>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" onChange={(e) => e.target.value && bulk.mutate({ action: 'PRIORITY', value: e.target.value })} defaultValue=""><option value="">Set priority</option>{priorities.filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" onChange={(e) => e.target.value && bulk.mutate({ action: 'STATUS', value: e.target.value })} defaultValue=""><option value="">Move status</option>{statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" onChange={(e) => e.target.value && bulk.mutate({ action: 'ASSIGN', value: e.target.value })} defaultValue=""><option value="">Assign</option>{memberRows.map((u: any) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}</select>
            <Button variant="outline" onClick={() => { const label = prompt('Label(s), comma separated'); if (label) bulk.mutate({ action: 'LABEL', value: label }); else alert('Label is required'); }}>Apply label</Button>
            <Button variant="destructive" onClick={() => confirm('Delete selected issues?') && bulk.mutate({ action: 'DELETE' })}>Delete</Button>
            <Button variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40"><th className="p-3"><input type="checkbox" checked={selectedAll} onChange={(e) => setSelected(e.target.checked ? issues.map((i: any) => i.id) : [])} /></th><th className="p-3 text-left">Key</th><th className="p-3 text-left">Title</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Priority</th><th className="p-3 text-left">Points</th><th className="p-3 text-left">Assignee</th><th className="p-3 text-left">Labels</th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-6 text-center text-muted-foreground" colSpan={9}>Loading issues…</td></tr>}
            {!isLoading && !issues.length && <tr><td className="p-6 text-center text-muted-foreground" colSpan={9}>No issues match the selected filters.</td></tr>}
            {issues.map((issue: any) => (
              <tr key={issue.id} className="border-b hover:bg-muted/40">
                <td className="p-3"><input type="checkbox" checked={selected.includes(issue.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, issue.id] : s.filter((x) => x !== issue.id))} /></td>
                <td className="p-3 font-medium"><Link to={`/projects/${id}/issues/${issue.id}`}>{issue.key}</Link></td>
                <td className="p-3">{issue.title}</td>
                <td className="p-3">{issue.issueType?.name}</td>
                <td className="p-3"><StatusBadge status={issue.workflowStatus} /></td>
                <td className="p-3"><PriorityBadge priority={issue.priority} /></td>
                <td className="p-3">{issue.storyPoints ?? 0}</td>
                <td className="p-3">{issue.assignee?.name ?? issue.assignee?.email ?? 'Unassigned'}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{(issue.labels ?? []).map((x: any) => <Badge key={x.label?.id ?? x.id} variant="outline">{x.label?.name ?? x.name}</Badge>)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
