import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '@/api/performance.api';
import { projectsApi } from '@/api/projects.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTimeReport } from '@/hooks/usePerformance';

export function TimeReportPage() {
  const [projectId, setProjectId] = useState('');
  const [groupBy, setGroupBy] = useState('user');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const params = { projectId: projectId || undefined, groupBy, from: from || undefined, to: to || undefined };
  const { data, isLoading } = useTimeReport(params);

  async function download() {
    const res = await performanceApi.exportTime(params);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Time report</h1>
          <p className="text-sm text-muted-foreground">Review and export logged work by user, project, issue, type, or day.</p>
        </div>
        <Button onClick={download}>Export CSV</Button>
      </div>

      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-5">
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.key} · {project.name}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="user">Group by user</option>
          <option value="project">Group by project</option>
          <option value="issue">Group by issue</option>
          <option value="issueType">Group by issue type</option>
          <option value="day">Group by day</option>
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="outline" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Worklogs</div><div className="text-2xl font-bold">{data?.summary.worklogCount ?? 0}</div></div>
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Hours</div><div className="text-2xl font-bold">{Math.round(data?.summary.hoursLogged ?? 0)}</div></div>
        <div className="rounded-lg border p-4"><div className="text-sm text-muted-foreground">Group by</div><div className="text-2xl font-bold capitalize">{groupBy}</div></div>
      </div>

      {isLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading report…</div>}

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr><th className="border-b p-3 text-left">Group</th><th className="border-b p-3 text-left">Worklogs</th><th className="border-b p-3 text-left">Hours</th></tr></thead>
          <tbody>
            {(data?.grouped ?? []).map((row) => <tr key={row.key}><td className="border-b p-3">{row.label}</td><td className="border-b p-3">{row.worklogCount}</td><td className="border-b p-3">{row.hours.toFixed(1)}</td></tr>)}
            {!(data?.grouped ?? []).length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No worklogs found for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
