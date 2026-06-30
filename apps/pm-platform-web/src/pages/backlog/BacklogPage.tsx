import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, MoveRight } from 'lucide-react';
import { backlogApi } from '@/api/backlog.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { useBacklog } from '@/hooks/useBacklog';
import { useSprints } from '@/hooks/useSprints';

export function BacklogPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { data: issues = [], isLoading } = useBacklog(id);
  const { data: sprints = [] } = useSprints(id);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetSprintId, setTargetSprintId] = useState('');
  const draftOrActive = sprints.filter((s) => s.status === 'DRAFT' || s.status === 'ACTIVE');
  const totalPoints = useMemo(() => issues.reduce((sum: number, issue: any) => sum + (issue.storyPoints ?? 0), 0), [issues]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['backlog', id] });
    qc.invalidateQueries({ queryKey: ['sprints', id] });
    qc.invalidateQueries({ queryKey: ['issues'] });
  };

  const moveToSprint = useMutation({ mutationFn: () => backlogApi.moveToSprint(id, selected, targetSprintId), onSuccess: () => { setSelected([]); invalidate(); } });
  const reorder = useMutation({ mutationFn: (body: { issueId: string; newPosition: number }) => backlogApi.reorder(id, body.issueId, body.newPosition), onSuccess: invalidate });

  function move(issueId: string, direction: -1 | 1) {
    const idx = issues.findIndex((issue: any) => issue.id === issueId);
    const target = issues[idx + direction];
    if (!target) return;
    const current = Number((issues[idx] as any).position ?? idx);
    const next = Number((target as any).position ?? idx + direction);
    reorder.mutate({ issueId, newPosition: (current + next) / 2 });
  }

  const selectedAll = issues.length > 0 && selected.length === issues.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Backlog</h1><p className="text-sm text-muted-foreground">Prioritize unsprinted work and move issues into active or upcoming sprints.</p></div>
        <div className="flex gap-2"><Badge>{issues.length} backlog issues</Badge><Badge>{totalPoints} story points</Badge></div>
      </div>

      {!!selected.length && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm font-medium">{selected.length} selected</span>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={targetSprintId} onChange={(e) => setTargetSprintId(e.target.value)}>
              <option value="">Choose sprint</option>
              {draftOrActive.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
            </select>
            <Button onClick={() => moveToSprint.mutate()} disabled={!targetSprintId || moveToSprint.isPending}><MoveRight className="h-4 w-4" /> Move to sprint</Button>
            <Button variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Backlog issues</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40"><th className="p-3"><input type="checkbox" checked={selectedAll} onChange={(e) => setSelected(e.target.checked ? issues.map((i: any) => i.id) : [])} /></th><th className="p-3 text-left">Rank</th><th className="p-3 text-left">Key</th><th className="p-3 text-left">Title</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Priority</th><th className="p-3 text-left">Points</th><th className="p-3 text-left">Assignee</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading backlog…</td></tr>}
              {!isLoading && !issues.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Backlog is empty.</td></tr>}
              {issues.map((issue: any, idx: number) => (
                <tr key={issue.id} className="border-b hover:bg-muted/40">
                  <td className="p-3"><input type="checkbox" checked={selected.includes(issue.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, issue.id] : current.filter((x) => x !== issue.id))} /></td>
                  <td className="p-3"><div className="flex gap-1"><Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(issue.id, -1)}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={idx === issues.length - 1} onClick={() => move(issue.id, 1)}><ArrowDown className="h-4 w-4" /></Button></div></td>
                  <td className="p-3 font-medium"><Link to={`/projects/${id}/issues/${issue.id}`}>{issue.key}</Link></td>
                  <td className="p-3">{issue.title}</td>
                  <td className="p-3"><StatusBadge status={issue.workflowStatus} /></td>
                  <td className="p-3"><PriorityBadge priority={issue.priority} /></td>
                  <td className="p-3">{issue.storyPoints ?? 0}</td>
                  <td className="p-3">{issue.assignee?.name ?? issue.assignee?.email ?? 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
