import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/projects.api';
import { issuesApi } from '@/api/issues.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { Feedback } from '@/components/common/Feedback';
import { useAuthStore } from '@/stores/auth.store';
import type { Issue, Project } from '@/types';

function isDone(issue: Issue) {
  return issue.workflowStatus?.category === 'DONE' || Boolean(issue.resolvedAt);
}

function isOverdue(issue: Issue) {
  if (!issue.dueDate || isDone(issue)) return false;
  return new Date(issue.dueDate).getTime() < Date.now();
}

function assigneeLabel(issue: Issue) {
  return issue.assignee?.name || issue.assignee?.email || 'Unassigned';
}

async function loadDashboard() {
  const projects = await projectsApi.list();
  const issueGroups = await Promise.all(
    projects.map(async (project) => {
      try {
        const result = await issuesApi.list(project.id, { page: 1, limit: 500 });
        return result.data.map((issue) => ({ ...issue, project }));
      } catch {
        return [] as Array<Issue & { project: Project }>;
      }
    })
  );

  return {
    projects,
    issues: issueGroups.flat(),
  };
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const dashboard = useQuery({ queryKey: ['dashboard-operational-summary'], queryFn: loadDashboard });

  const projects = dashboard.data?.projects ?? [];
  const issues = dashboard.data?.issues ?? [];
  const openIssues = issues.filter((issue) => !isDone(issue));
  const doneIssues = issues.filter(isDone);
  const myIssues = openIssues.filter((issue) => issue.assignee?.id === user?.id || issue.assignee?.email === user?.email);
  const unassignedIssues = openIssues.filter((issue) => !issue.assignee);
  const overdueIssues = openIssues.filter(isOverdue);

  const byAssignee = Array.from(
    openIssues.reduce((map, issue) => {
      const key = assigneeLabel(issue);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const byPriority = Array.from(
    openIssues.reduce((map, issue) => {
      const key = issue.priority || 'NONE';
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const recent = [...issues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8);

  if (dashboard.isLoading) return <div className="space-y-4"><h1 className="text-3xl font-bold">Dashboard</h1><div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading dashboard data…</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Operational view of project work, ownership, and recent activity.</p>
      </div>

      {dashboard.error && <Feedback tone="error" title="Dashboard data failed to load" message="Some project or issue statistics could not be loaded. Refresh the page or check API health." />}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric title="Projects" value={projects.length} />
        <Metric title="Total tickets" value={issues.length} />
        <Metric title="Open" value={openIssues.length} />
        <Metric title="Done" value={doneIssues.length} />
        <Metric title="Assigned to me" value={myIssues.length} />
        <Metric title="Unassigned" value={unassignedIssues.length} tone={unassignedIssues.length ? 'warning' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Tickets by assignee</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {byAssignee.length ? byAssignee.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{name}</span><Badge>{count}</Badge>
              </div>
            )) : <EmptyState title="No open tickets" description="Open tickets will appear grouped by assignee." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Priority pressure</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {byPriority.length ? byPriority.map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{priority}</span><Badge>{count}</Badge>
              </div>
            )) : <EmptyState title="No priority data" description="Open issue priorities will appear here." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Attention needed</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>Overdue tickets</span><Badge>{overdueIssues.length}</Badge></div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>Unassigned tickets</span><Badge>{unassignedIssues.length}</Badge></div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>My open tickets</span><Badge>{myIssues.length}</Badge></div>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent active tickets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recent.length ? recent.map((issue: Issue & { project?: Project }) => (
              <Link key={issue.id} to={`/projects/${issue.projectId}/issues/${issue.id}`} className="block rounded-lg border p-3 hover:bg-accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{issue.key} · {issue.title}</div>
                  <Badge>{issue.workflowStatus?.name ?? 'No status'}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Project: {issue.project?.name ?? issue.projectId} · Assignee: {assigneeLabel(issue)} · Priority: {issue.priority}
                </div>
              </Link>
            )) : <EmptyState title="No tickets yet" description="Create tickets to see recent activity." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projects.length ? projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}/board`} className="block rounded-lg border p-3 hover:bg-accent">
                <div className="font-semibold">{project.name}</div>
                <div className="text-sm text-muted-foreground">{project.key} · {project._count?.issues ?? 0} issues · {project._count?.members ?? 0} members</div>
              </Link>
            )) : <EmptyState title="No projects" description="Create a project to start planning." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ title, value, tone }: { title: string; value: number; tone?: 'warning' }) {
  return (
    <Card className={tone === 'warning' ? 'border-amber-200 bg-amber-50' : undefined}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
