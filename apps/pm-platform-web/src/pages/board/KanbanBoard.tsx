import { useMemo, useState } from 'react';
import { closestCorners, DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LayoutGrid, Sparkles, Users, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BoardColumn } from '@/components/board/BoardColumn';
import { BoardCardPreview } from '@/components/board/BoardCard';
import { SwimlaneGroup } from '@/components/board/SwimlaneGroup';
import { IssueForm } from '@/components/issues/IssueForm';
import { projectsApi } from '@/api/projects.api';
import { issuesApi } from '@/api/issues.api';
import { queryKeys } from '@/api/queryKeys';
import { useIssues } from '@/hooks/useIssues';
import type { Issue, WorkflowStatus } from '@/types';

type Lane = 'none' | 'assignee' | 'priority' | 'label';
type IssueResult = { data: Issue[]; meta?: unknown };

function statusIdOf(issue: Issue) {
  return issue.workflowStatusId ?? issue.workflowStatus?.id;
}

function laneKey(issue: Issue, swimlane: Lane) {
  if (swimlane === 'assignee') return issue.assignee?.name ?? 'Unassigned';
  if (swimlane === 'priority') return issue.priority ?? 'NONE';
  if (swimlane === 'label') {
    const first = issue.labels?.[0] as any;
    return first?.label?.name ?? first?.name ?? 'No label';
  }
  return 'Board';
}

function buildLaneGroups(issues: Issue[], statuses: WorkflowStatus[], swimlane: Lane) {
  const laneNames = swimlane === 'none'
    ? ['Board']
    : Array.from(new Set(issues.map((issue) => laneKey(issue, swimlane)))).sort((a, b) => a.localeCompare(b));

  return laneNames.map((lane) => ({
    lane,
    byStatus: Object.fromEntries(
      statuses.map((status) => [
        status.id,
        issues.filter((issue) => laneKey(issue, swimlane) === lane && statusIdOf(issue) === status.id)
      ])
    ) as Record<string, Issue[]>
  }));
}

function patchIssueStatus(issue: Issue, targetStatus: WorkflowStatus) {
  const isDone = targetStatus.category === 'DONE';
  return {
    ...issue,
    workflowStatus: targetStatus,
    workflowStatusId: targetStatus.id,
    resolvedAt: isDone ? (issue.resolvedAt ?? new Date().toISOString()) : null,
    updatedAt: new Date().toISOString()
  } as Issue;
}

function mergeIssue(issue: Issue, update: Partial<Issue>) {
  return {
    ...issue,
    ...update,
    workflowStatus: update.workflowStatus ?? issue.workflowStatus,
    workflowStatusId: update.workflowStatusId ?? update.workflowStatus?.id ?? issue.workflowStatusId
  } as Issue;
}

export function KanbanBoard() {
  const { id: projectId = '' } = useParams();
  const qc = useQueryClient();
  const [swimlane, setSwimlane] = useState<Lane>('none');
  const [newStatus, setNewStatus] = useState<WorkflowStatus | null>(null);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [movingIssueId, setMovingIssueId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const { data: issuesResult, isLoading: issuesLoading, error: issuesError } = useIssues(projectId);
  const issues = issuesResult?.data ?? [];
  const statuses = project?.workflows?.[0]?.statuses ?? [];
  const totalWip = issues.filter((issue) => issue.workflowStatus?.category !== 'DONE').length;
  const completed = issues.filter((issue) => issue.workflowStatus?.category === 'DONE').length;

  function updateIssueQueries(issueId: string, updater: (issue: Issue) => Issue) {
    const snapshots = qc.getQueriesData<IssueResult>({ queryKey: ['issues', projectId] });
    for (const [key, previous] of snapshots) {
      if (!previous?.data) continue;
      qc.setQueryData<IssueResult>(key, {
        ...previous,
        data: previous.data.map((issue) => issue.id === issueId ? updater(issue) : issue)
      });
    }
  }

  const transition = useMutation({
    mutationFn: ({ issueId, toStatusId }: { issueId: string; toStatusId: string }) => issuesApi.transition(projectId, issueId, toStatusId),
    onMutate: async ({ issueId, toStatusId }) => {
      setTransitionError(null);
      setMovingIssueId(issueId);

      await qc.cancelQueries({ queryKey: ['issues', projectId] });
      await qc.cancelQueries({ queryKey: queryKeys.project(projectId) });

      const snapshots = qc.getQueriesData<IssueResult>({ queryKey: ['issues', projectId] });
      const previousProject = qc.getQueryData(queryKeys.project(projectId));
      const targetStatus = statuses.find((status) => status.id === toStatusId);

      if (targetStatus) {
        updateIssueQueries(issueId, (issue) => patchIssueStatus(issue, targetStatus));
      }

      return { snapshots, previousProject, targetStatus };
    },
    onSuccess: (savedIssue, vars, context) => {
      const targetStatus = savedIssue.workflowStatus ?? context?.targetStatus;
      updateIssueQueries(vars.issueId, (issue) => mergeIssue(issue, targetStatus ? { ...savedIssue, workflowStatus: targetStatus, workflowStatusId: targetStatus.id } : savedIssue));
      qc.setQueryData(queryKeys.issue(vars.issueId), savedIssue);

      // Mark related data stale without active refetch. This prevents the visible board flash while keeping future reads fresh.
      window.setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['issues', projectId], refetchType: 'none' });
        qc.invalidateQueries({ queryKey: queryKeys.project(projectId), refetchType: 'none' });
      }, 1200);
    },
    onError: (error, _vars, context) => {
      for (const [key, value] of context?.snapshots ?? []) qc.setQueryData(key, value);
      if (context?.previousProject) qc.setQueryData(queryKeys.project(projectId), context.previousProject);
      setTransitionError(`Cannot move issue: ${error instanceof Error ? error.message : 'the transition was rejected.'}`);
    },
    onSettled: () => {
      window.setTimeout(() => setMovingIssueId(null), 250);
      setActiveIssue(null);
    }
  });

  const laneGroups = useMemo(() => buildLaneGroups(issues, statuses, swimlane), [issues, statuses, swimlane]);

  function overToStatusId(overId: string) {
    if (statuses.some((status) => status.id === overId)) return overId;
    const overIssue = issues.find((issue) => issue.id === overId);
    return overIssue ? statusIdOf(overIssue) : undefined;
  }

  function onDragStart(event: DragStartEvent) {
    const issueId = String(event.active.id);
    setActiveIssue(issues.find((issue) => issue.id === issueId) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const issueId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : undefined;
    if (!overId) {
      setActiveIssue(null);
      return;
    }

    const toStatusId = overToStatusId(overId);
    const current = issues.find((issue) => issue.id === issueId);
    if (toStatusId && current && statusIdOf(current) !== toStatusId) transition.mutate({ issueId, toStatusId });
    else setActiveIssue(null);
  }

  if (projectLoading || issuesLoading) {
    return <div className="grid min-h-[360px] place-items-center rounded-2xl border bg-card/60 text-sm text-muted-foreground">Loading Trello board…</div>;
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl"
      >
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Trello-style live board
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{project?.name ?? 'Project'} Board</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Drag cards across workflow columns. Cards move immediately, save in the background, and roll back only if the backend rejects the transition.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><div className="text-2xl font-bold">{issues.length}</div><div className="text-xs text-slate-300">Total issues</div></div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><div className="text-2xl font-bold">{totalWip}</div><div className="text-xs text-slate-300">Active work</div></div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><div className="text-2xl font-bold">{completed}</div><div className="text-xs text-slate-300">Done</div></div>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" /> Loaded {issues.length} issues across {statuses.length} workflow columns
          {movingIssueId && <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"><Loader2 className="h-3 w-3 animate-spin" />Saving move…</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={swimlane === 'none' ? 'default' : 'outline'} onClick={() => setSwimlane('none')}>Board</Button>
          <Button size="sm" variant={swimlane === 'assignee' ? 'default' : 'outline'} onClick={() => setSwimlane('assignee')}><Users className="h-4 w-4" />Assignee</Button>
          <Button size="sm" variant={swimlane === 'priority' ? 'default' : 'outline'} onClick={() => setSwimlane('priority')}>Priority</Button>
          <Button size="sm" variant={swimlane === 'label' ? 'default' : 'outline'} onClick={() => setSwimlane('label')}>Label</Button>
        </div>
      </div>

      {issuesError && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Could not load issues: {(issuesError as Error).message}</div>}
      {transitionError && <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="h-4 w-4" />{transitionError}</div>}

      <DndContext collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveIssue(null)}>
        <AnimatePresence initial={false} mode="popLayout">
          {laneGroups.map(({ lane, byStatus }) => (
            <SwimlaneGroup key={lane} label={swimlane === 'none' ? 'Kanban' : lane}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {statuses.map((status) => (
                  <BoardColumn
                    key={`${lane}-${status.id}`}
                    status={status}
                    issues={byStatus[status.id] ?? []}
                    onNewIssue={setNewStatus}
                    isSaving={Boolean(movingIssueId)}
                  />
                ))}
              </div>
            </SwimlaneGroup>
          ))}
        </AnimatePresence>
        <DragOverlay dropAnimation={{ duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {activeIssue ? <BoardCardPreview issue={activeIssue} /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={Boolean(newStatus)} onOpenChange={(open) => !open && setNewStatus(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create issue in {newStatus?.name}</DialogTitle></DialogHeader>
          {newStatus && <IssueForm projectId={projectId} workflowStatusId={newStatus.id} onDone={() => setNewStatus(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
