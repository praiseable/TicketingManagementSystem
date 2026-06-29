import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Save, Star, StarOff } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttachmentUpload } from './AttachmentUpload';
import { IssueHistory } from './IssueHistory';
import { IssueLinks } from './IssueLinks';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { SubTaskList } from './SubTaskList';
import { LiveTimer } from '@/components/time/LiveTimer';
import { TimeProgress } from '@/components/time/TimeProgress';
import { WorklogList } from '@/components/time/WorklogList';
import { commentsApi } from '@/api/comments.api';
import { issuesApi } from '@/api/issues.api';
import { projectsApi } from '@/api/projects.api';
import { queryKeys } from '@/api/queryKeys';
import { useIssue, useUpdateIssue } from '@/hooks/useIssues';
import { useAuthStore } from '@/stores/auth.store';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { Comment, Issue, Label, Priority } from '@/types';

const priorities: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
function labelNames(issue: Issue) {
  return (issue.labels ?? []).map((entry: any) => entry?.label?.name ?? entry?.name).filter(Boolean) as string[];
}
function moneyDate(value?: string | null) { return value ? value.slice(0, 10) : ''; }
function toIsoDate(value: string) { return value ? new Date(`${value}T00:00:00`).toISOString() : null; }

function CommentItem({ issueId, comment }: { issueId: string; comment: Comment }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const update = useMutation({ mutationFn: () => commentsApi.update(issueId, comment.id, { body }), onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: ['comments', issueId] }); qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) }); } });
  const remove = useMutation({ mutationFn: () => commentsApi.remove(issueId, comment.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', issueId] }); qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) }); } });
  const canEdit = user?.id === comment.user?.id || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  return <div className="rounded-lg border p-3 text-sm">
    <div className="mb-2 flex items-center justify-between gap-2"><div><span className="font-medium">{comment.user?.name ?? 'User'}</span> <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()} {comment.isEdited ? '· edited' : ''}</span></div>{canEdit && <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</Button><Button size="sm" variant="ghost" onClick={() => remove.mutate()}>Delete</Button></div>}</div>
    {editing ? <div className="space-y-2"><Textarea value={body} onChange={(e) => setBody(e.target.value)} /><Button size="sm" onClick={() => update.mutate()} disabled={!body.trim() || update.isPending}><Save className="h-4 w-4" />Save</Button></div> : <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>}
    {!!comment.replies?.length && <div className="mt-3 space-y-2 border-l pl-3">{comment.replies.map((reply) => <CommentItem key={reply.id} issueId={issueId} comment={reply} />)}</div>}
  </div>;
}

function CommentsPanel({ issue }: { issue: Issue }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const create = useMutation({ mutationFn: () => commentsApi.create(issue.id, { body }), onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['comments', issue.id] }); qc.invalidateQueries({ queryKey: queryKeys.issue(issue.id) }); } });
  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">Comments <span className="text-xs text-muted-foreground">({issue.comments?.length ?? 0})</span></h3>
    <div className="space-y-2"><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment. Mention with @user@email.com" /><Button disabled={!body.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Posting…' : 'Post comment'}</Button></div>
    <div className="space-y-2">{issue.comments?.map((c) => <CommentItem key={c.id} issueId={issue.id} comment={c} />)}{!issue.comments?.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}</div>
  </div>;
}

export function IssueDetail({ projectId, issueId }: { projectId: string; issueId: string }) {
  const { data: issue, isLoading, error } = useIssue(projectId, issueId);
  const update = useUpdateIssue(projectId);
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [params] = useSearchParams();
  const [historyOpen, setHistoryOpen] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labelsText, setLabelsText] = useState('');
  const panel = params.get('panel') === 'true';
  const { data: project } = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId), enabled: Boolean(projectId) });
  const { data: members = [] } = useQuery({ queryKey: ['project-members', projectId], queryFn: () => projectsApi.members(projectId), enabled: Boolean(projectId) });
  const { data: issueTypes = [] } = useQuery({ queryKey: ['issue-types', projectId], queryFn: () => projectsApi.issueTypes(projectId), enabled: Boolean(projectId) });
  const workflows = project?.workflows ?? [];
  const statuses = workflows.flatMap((wf: any) => wf.statuses ?? []);
  const memberUsers = (members as any[]).map((m) => m.user ?? m).filter(Boolean);
  const logged = useMemo(() => (issue?.worklogs ?? []).reduce((s, w) => s + Number(w.timeSpent ?? 0), 0), [issue]);
  const isWatching = Boolean(issue?.watchers?.some((w: any) => w.userId === user?.id));
  const watch = useMutation({ mutationFn: () => isWatching ? issuesApi.unwatch(projectId, issueId) : issuesApi.watch(projectId, issueId), onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) }) });

  useEffect(() => {
    if (!issue) return;
    setTitle(issue.title ?? '');
    setDescription(loadedIssue.description ?? '');
    setLabelsText(labelNames(issue).join(', '));
  }, [issue?.id, issue?.title, issue?.description, JSON.stringify(issue?.labels ?? [])]);

  if (isLoading) return <LoadingSpinner />;
  if (error || !issue) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">Issue could not be loaded.</div>;

  const loadedIssue = issue;
  function patch(body: Record<string, unknown>) { update.mutate({ issueId, body }); }
  function saveTitle() { if (title.trim() && title !== loadedIssue.title) patch({ title: title.trim() }); }
  function saveDescription() { if (description !== (loadedIssue.description ?? '')) patch({ description }); }
  function saveLabels() { patch({ labels: labelsText.split(',').map((x) => x.trim()).filter(Boolean) }); }

  return <div className={panel ? 'fixed inset-y-0 right-0 z-40 w-full max-w-6xl overflow-auto border-l bg-background p-6 shadow-2xl' : 'mx-auto max-w-7xl p-4'}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><div><Link to="/projects" className="hover:underline">Projects</Link> › <Link to={`/projects/${projectId}/board`} className="hover:underline">{project?.name ?? 'Project'}</Link> › {issue.issueType?.name} › <span className="font-mono">{issue.key}</span></div><div className="flex items-center gap-2"><Badge>{issue._count?.comments ?? issue.comments?.length ?? 0} comments</Badge><Badge>{issue._count?.attachments ?? issue.attachments?.length ?? 0} files</Badge><Button size="sm" variant="outline" onClick={() => watch.mutate()}>{isWatching ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />} {isWatching ? 'Unwatch' : 'Watch'}</Button></div></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
      <section className="space-y-6">
        <div className="rounded-xl border bg-card p-4"><Input className="h-auto border-0 px-0 text-3xl font-bold shadow-none focus-visible:ring-0" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} /><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={issue.workflowStatus} /><PriorityBadge priority={issue.priority} />{labelNames(issue).map((name) => <Badge key={name}>{name}</Badge>)}</div></div>
        <div className="rounded-xl border bg-card p-4"><h3 className="mb-2 font-semibold">Description</h3><Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveDescription} className="min-h-40" placeholder="Describe the work, acceptance criteria, or notes…" /></div>
        <SubTaskList projectId={projectId} parentIssue={issue} />
        <CommentsPanel issue={issue} />
        <IssueLinks projectId={projectId} issue={issue} />
        <AttachmentUpload issueId={issue.id} attachments={issue.attachments} />
        <div className="rounded-xl border bg-card p-4"><Button variant="ghost" onClick={() => setHistoryOpen((v) => !v)}>{historyOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {historyOpen ? 'Hide history' : 'Show history'}</Button>{historyOpen && <div className="mt-3"><IssueHistory history={issue.histories} /></div>}</div>
      </section>
      <aside className="space-y-4">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h3 className="font-semibold">Details</h3>
          <div className="space-y-3 text-sm">
            <div><div className="mb-1 text-muted-foreground">Status</div><Select value={issue.workflowStatusId ?? issue.workflowStatus?.id} onValueChange={(value) => patch({ workflowStatusId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><div className="mb-1 text-muted-foreground">Priority</div><Select value={issue.priority} onValueChange={(value) => patch({ priority: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div><div className="mb-1 text-muted-foreground">Assignee</div><Select value={issue.assigneeId ?? 'unassigned'} onValueChange={(value) => patch({ assigneeId: value === 'unassigned' ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{memberUsers.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}</SelectContent></Select></div>
            {!!issueTypes.length && <div><div className="mb-1 text-muted-foreground">Type</div><Select value={issue.issueType?.id} onValueChange={(value) => patch({ issueTypeId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{issueTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>}
            <div className="grid grid-cols-2 gap-3"><div><div className="mb-1 text-muted-foreground">Story points</div><Input type="number" value={issue.storyPoints ?? ''} onChange={(e) => patch({ storyPoints: e.target.value ? Number(e.target.value) : null })} /></div><div><div className="mb-1 text-muted-foreground">Due date</div><Input type="date" value={moneyDate(issue.dueDate)} onChange={(e) => patch({ dueDate: toIsoDate(e.target.value) })} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><div className="mb-1 text-muted-foreground">Original estimate sec</div><Input type="number" value={issue.originalEstimate ?? ''} onChange={(e) => patch({ originalEstimate: e.target.value ? Number(e.target.value) : null })} /></div><div><div className="mb-1 text-muted-foreground">Remaining sec</div><Input type="number" value={issue.remainingEstimate ?? ''} onChange={(e) => patch({ remainingEstimate: e.target.value ? Number(e.target.value) : null })} /></div></div>
            <div><div className="mb-1 text-muted-foreground">Labels</div><div className="flex gap-2"><Input value={labelsText} onChange={(e) => setLabelsText(e.target.value)} placeholder="frontend, urgent" /><Button variant="outline" onClick={saveLabels}>Save</Button></div></div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4"><h3 className="mb-2 font-semibold">Custom fields</h3>{issue.customFieldValues?.length ? issue.customFieldValues.map((field: any) => <div key={field.id} className="mb-2 rounded-md border p-2 text-sm"><span className="text-muted-foreground">{field.customField?.name ?? field.customFieldId}</span><div>{field.value ?? '—'}</div></div>) : <p className="text-sm text-muted-foreground">No custom fields configured.</p>}</div>
        <TimeProgress logged={logged} estimate={issue.originalEstimate} />
        <LiveTimer issueId={issue.id} />
        <div className="rounded-xl border bg-card p-4"><h3 className="mb-2 font-semibold">Worklogs</h3><WorklogList worklogs={issue.worklogs} /></div>
        <div className="rounded-xl border bg-card p-4"><h3 className="mb-2 font-semibold">Watchers</h3><div className="space-y-1 text-sm">{issue.watchers?.map((w: any) => <div key={w.id} className="rounded-md border px-2 py-1">{w.user?.name ?? w.userId}</div>)}{!issue.watchers?.length && <p className="text-muted-foreground">No watchers yet.</p>}</div></div>
      </aside>
    </div>
  </div>;
}
