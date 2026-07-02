import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/projects.api';
import { issuesApi } from '@/api/issues.api';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import type { Issue, Project } from '@/types';

type DashboardIssue = Issue & { project?: Pick<Project, 'id' | 'name' | 'key'> };

function isDone(issue: DashboardIssue) {
  return issue.workflowStatus?.category === 'DONE' || Boolean(issue.resolvedAt);
}

function priorityRank(priority?: string) {
  const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
  return order[priority ?? 'NONE'] ?? 0;
}

function assigneeKey(issue: DashboardIssue) {
  return issue.assignee?.id ?? 'unassigned';
}

function assigneeName(issue: DashboardIssue) {
  return issue.assignee?.name || issue.assignee?.email || 'Unassigned';
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const projects = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  const issuesQuery = useQuery({
    queryKey: ['dashboard-issues', (projects.data ?? []).map((p) => p.id).join(',')],
    enabled: Boolean(projects.data?.length),
    queryFn: async () => {
      const rows = await Promise.all(
        (projects.data ?? []).map(async (project) => {
          const result = await issuesApi.list(project.id, { page: 1, limit: 500 });
          return (result.data ?? []).map((issue) => ({ ...issue, project: { id: project.id, name: project.name, key: project.key } }));
        })
      );
      return rows.flat() as DashboardIssue[];
    }
  });

  const issues = issuesQuery.data ?? [];
  const openIssues = issues.filter((issue) => !isDone(issue));
  const doneIssues = issues.filter(isDone);
  const myOpenIssues = openIssues.filter((issue) => issue.assignee?.id === user?.id);
  const unassignedIssues = openIssues.filter((issue) => !issue.assignee?.id);
  const urgentIssues = openIssues.filter((issue) => ['CRITICAL', 'HIGH'].includes(issue.priority));

  const assigneeRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string; open: number; done: number; urgent: number; issues: DashboardIssue[] }>();

    for (const issue of issues) {
      const key = assigneeKey(issue);
      const row = map.get(key) ?? {
        id: key,
        name: assigneeName(issue),
        email: issue.assignee?.email,
        open: 0,
        done: 0,
        urgent: 0,
        issues: [],
      };

      if (isDone(issue)) row.done += 1;
      else row.open += 1;

      if (!isDone(issue) && ['CRITICAL', 'HIGH'].includes(issue.priority)) row.urgent += 1;
      row.issues.push(issue);
      map.set(key, row);
    }

    return Array.from(map.values()).sort((a, b) => b.open - a.open || b.urgent - a.urgent || a.name.localeCompare(b.name));
  }, [issues]);

  const recentWork = [...openIssues]
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const isLoading = projects.isLoading || issuesQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live project, ticket, assignee, priority, and sprint execution overview.</p>
      </div>

      {(projects.error || issuesQuery.error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load all dashboard data. Refresh the page or check API health.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle>Projects</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{projects.data?.length ?? 0}</div><p className="text-xs text-muted-foreground">Active project spaces</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Total tickets</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{issues.length}</div><p className="text-xs text-muted-foreground">Loaded from all projects</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Open work</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{openIssues.length}</div><p className="text-xs text-muted-foreground">Not done yet</p></CardContent></Card>
        <Card><CardHeader><CardTitle>My open tickets</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{myOpenIssues.length}</div><p className="text-xs text-muted-foreground">Assigned to {user?.name ?? 'me'}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Completed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{doneIssues.length}</div><p className="text-xs text-muted-foreground">Done or resolved</p></CardContent></Card>
        <Card><CardHeader><CardTitle>High priority</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{urgentIssues.length}</div><p className="text-xs text-muted-foreground">Critical / high open tickets</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Unassigned</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{unassignedIssues.length}</div><p className="text-xs text-muted-foreground">Open tickets without owner</p></CardContent></Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tickets by assignee</h2>
          {isLoading && <span className="text-xs text-muted-foreground">Loading live issue data…</span>}
        </div>
        {assigneeRows.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Open</th>
                  <th className="p-3">Done</th>
                  <th className="p-3">Critical/High</th>
                  <th className="p-3">Current tickets</th>
                </tr>
              </thead>
              <tbody>
                {assigneeRows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3"><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.email ?? (row.id === 'unassigned' ? 'Needs assignment' : '')}</div></td>
                    <td className="p-3 font-semibold">{row.open}</td>
                    <td className="p-3">{row.done}</td>
                    <td className="p-3">{row.urgent}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {row.issues.filter((issue) => !isDone(issue)).slice(0, 5).map((issue) => (
                          <Link key={issue.id} to={`/projects/${issue.projectId}/issues/${issue.id}`} className="rounded-full border px-2 py-1 text-xs hover:bg-accent">
                            {issue.key}
                          </Link>
                        ))}
                        {row.open > 5 && <Badge>+{row.open - 5}</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No ticket assignments" description="Create or assign issues to see ownership here." />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Recent active tickets</h2>
          {recentWork.length ? (
            <div className="space-y-2">
              {recentWork.map((issue) => (
                <Link key={issue.id} to={`/projects/${issue.projectId}/issues/${issue.id}`} className="block rounded-lg border p-3 hover:bg-accent">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{issue.key} · {issue.title}</div>
                    <Badge>{issue.priority}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {issue.project?.key ?? issue.projectId} · {issue.workflowStatus?.name ?? 'No status'} · Assigned to {assigneeName(issue)}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No active tickets" description="There are no open tickets in the loaded projects." />
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Recent projects</h2>
          {projects.data?.length ? (
            <div className="grid gap-3">
              {projects.data.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}/board`} className="rounded-lg border p-4 hover:bg-accent">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.key} · {p._count?.issues ?? 0} issues · {p._count?.members ?? 0} members</div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No projects" description="Create a project to start planning." />
          )}
        </div>
      </section>
    </div>
  );
}
