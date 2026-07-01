import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects.api';
import { Button } from '@/components/ui/button';
import { TeamTable } from '@/components/performance/TeamTable';
import { useTeamPerformance } from '@/hooks/usePerformance';

export function TeamPerformancePage() {
  const [range, setRange] = useState('month');
  const [projectId, setProjectId] = useState('');
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const { data, isLoading } = useTeamPerformance(projectId ? { projectId, period: range } : { period: range });
  const totals = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Team performance</h1>
          <p className="text-sm text-muted-foreground">Compare assigned work, completed issues, logged hours and story points by team member.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.key} · {project.name}</option>)}
          </select>
          {['week', 'month', 'quarter'].map((x) => <Button key={x} variant={range === x ? 'default' : 'outline'} onClick={() => setRange(x)}>{x}</Button>)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Members</div><div className="text-2xl font-bold">{totals?.members ?? 0}</div></div>
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Completed</div><div className="text-2xl font-bold">{totals?.issuesCompleted ?? 0}</div></div>
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Hours</div><div className="text-2xl font-bold">{Math.round(totals?.hoursLogged ?? 0)}</div></div>
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Story points</div><div className="text-2xl font-bold">{totals?.storyPointsDelivered ?? 0}</div></div>
      </div>

      {isLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading team performance…</div>}
      <TeamTable data={data?.rows ?? []} />
    </div>
  );
}
