import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Flag, Play, Plus, Target } from 'lucide-react';
import { sprintsApi } from '@/api/sprints.api';
import { BurndownChart } from '@/components/sprints/BurndownChart';
import { VelocityChart } from '@/components/sprints/VelocityChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSprints } from '@/hooks/useSprints';
import type { Sprint } from '@/types';

function isoLocalDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function toIso(date: string, end = false) {
  return new Date(`${date}T${end ? '23:59:59' : '00:00:00'}.000Z`).toISOString();
}

function statusClass(status: Sprint['status']) {
  if (status === 'ACTIVE') return 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30';
  if (status === 'COMPLETED') return 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30';
  return 'border-slate-300 bg-background';
}

export function SprintsPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { data = [], isLoading } = useSprints(id);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [form, setForm] = useState({ name: '', goal: '', capacity: '20', startDate: isoLocalDate(0), endDate: isoLocalDate(14) });

  const active = data.find((s) => s.status === 'ACTIVE');
  const selected = data.find((s) => s.id === selectedSprintId) ?? active ?? data[0];
  const draftSprints = data.filter((s) => s.status === 'DRAFT');

  const burndown = useQuery({ queryKey: ['burndown', selected?.id], queryFn: () => sprintsApi.burndown(id, selected!.id), enabled: Boolean(id && selected) });
  const velocity = useQuery({ queryKey: ['velocity', id], queryFn: () => sprintsApi.velocity(id), enabled: Boolean(id) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sprints', id] });
    qc.invalidateQueries({ queryKey: ['backlog', id] });
    qc.invalidateQueries({ queryKey: ['issues'] });
  };

  const createSprint = useMutation({
    mutationFn: () => sprintsApi.create(id, { name: form.name, goal: form.goal || null, capacity: Number(form.capacity || 0), startDate: toIso(form.startDate), endDate: toIso(form.endDate, true) } as any),
    onSuccess: (sprint) => { setSelectedSprintId(sprint.id); setForm({ name: '', goal: '', capacity: '20', startDate: isoLocalDate(0), endDate: isoLocalDate(14) }); invalidate(); }
  });
  const startSprint = useMutation({ mutationFn: (sprintId: string) => sprintsApi.start(id, sprintId), onSuccess: invalidate });
  const completeSprint = useMutation({ mutationFn: (body: { sprintId: string; moveToSprintId?: string | null }) => sprintsApi.complete(id, body.sprintId, body.moveToSprintId), onSuccess: invalidate });

  const grouped = useMemo(() => {
    const rows = selected?.issues ?? [];
    return {
      todo: rows.filter((i) => i.workflowStatus?.category === 'TODO'),
      progress: rows.filter((i) => i.workflowStatus?.category === 'IN_PROGRESS'),
      done: rows.filter((i) => i.workflowStatus?.category === 'DONE')
    };
  }, [selected]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sprints</h1>
          <p className="text-sm text-muted-foreground">Create, start, run, complete, and report on project sprints.</p>
        </div>
        <Badge>{active ? `Active: ${active.name}` : 'No active sprint'}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Create sprint</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <Input className="md:col-span-2" placeholder="Sprint name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Goal" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} />
          <Input type="number" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
          <div className="flex gap-2 md:col-span-6">
            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            <Button onClick={() => form.name.trim() ? createSprint.mutate() : alert('Sprint name is required')} disabled={!form.name || createSprint.isPending}>Create</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>All sprints</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading sprints…</p>}
            {data.map((sprint) => (
              <button key={sprint.id} type="button" onClick={() => setSelectedSprintId(sprint.id)} className={`w-full rounded-lg border p-3 text-left transition hover:bg-accent ${selected?.id === sprint.id ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{sprint.name}</span><span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(sprint.status)}`}>{sprint.status}</span></div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sprint.goal || 'No goal defined'}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{sprint._count?.issues ?? sprint.issues?.length ?? 0} issues</span><span>{sprint.committedStoryPoints ?? 0} pts</span><span>Cap {sprint.capacity ?? 0}</span></div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Sprint detail</CardTitle></CardHeader>
          <CardContent>
            {!selected ? <p className="text-sm text-muted-foreground">Create a sprint to begin.</p> : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-2xl font-semibold">{selected.name}</h2><p className="text-sm text-muted-foreground">{selected.goal || 'No sprint goal'}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === 'DRAFT' && <Button onClick={() => startSprint.mutate(selected.id)} disabled={startSprint.isPending}><Play className="h-4 w-4" /> Start</Button>}
                    {selected.status === 'ACTIVE' && <Button onClick={() => window.confirm('Complete sprint? Incomplete issues will be moved.') && completeSprint.mutate({ sprintId: selected.id, moveToSprintId: draftSprints.find((s) => s.id !== selected.id)?.id ?? null })} disabled={completeSprint.isPending}><CheckCircle2 className="h-4 w-4" /> Complete</Button>}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Status</div><div className="font-semibold">{selected.status}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Capacity</div><div className="font-semibold">{selected.capacity ?? 0}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Committed</div><div className="font-semibold">{selected.committedStoryPoints ?? 0} pts</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Completed</div><div className="font-semibold">{selected.completedStoryPoints ?? 0} pts</div></div>
                </div>
                <div className="text-sm text-muted-foreground"><CalendarDays className="mr-1 inline h-4 w-4" /> {new Date(selected.startDate).toLocaleDateString()} — {new Date(selected.endDate).toLocaleDateString()}</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-3"><h3 className="font-semibold">Todo</h3><p className="text-2xl font-bold">{grouped.todo.length}</p></div>
                  <div className="rounded-lg border p-3"><h3 className="font-semibold">In progress</h3><p className="text-2xl font-bold">{grouped.progress.length}</p></div>
                  <div className="rounded-lg border p-3"><h3 className="font-semibold">Done</h3><p className="text-2xl font-bold">{grouped.done.length}</p></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BurndownChart data={burndown.data} />
        <VelocityChart data={velocity.data?.map((x) => ({ name: x.name, committed: x.committed, completed: x.completed }))} />
      </div>
    </div>
  );
}
