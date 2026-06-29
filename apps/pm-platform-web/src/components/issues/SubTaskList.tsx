import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Square, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { issuesApi } from '@/api/issues.api';
import { queryKeys } from '@/api/queryKeys';
import type { Issue } from '@/types';

export function SubTaskList({ projectId, parentIssue }: { projectId: string; parentIssue: Issue }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const qc = useQueryClient();
  const subtasks = parentIssue.children ?? [];
  const create = useMutation({
    mutationFn: () => issuesApi.create(projectId, {
      title,
      description: '',
      parentId: parentIssue.id,
      issueTypeId: parentIssue.issueType?.id,
      workflowStatusId: parentIssue.workflowStatus?.id,
      priority: parentIssue.priority
    }),
    onSuccess: () => {
      setTitle('');
      setOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.issue(parentIssue.id) });
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
    }
  });

  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">Sub-tasks <span className="text-xs text-muted-foreground">({subtasks.length})</span></h3>
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? 'Cancel' : 'Add'}</Button>
    </div>
    {open && <div className="flex gap-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sub-task title" onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) create.mutate(); }} />
      <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Adding…' : 'Create'}</Button>
    </div>}
    <div className="space-y-2">
      {subtasks.map((task) => <Link key={task.id} to={`/projects/${projectId}/issues/${task.id}`} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent">
        <span className="flex items-center gap-2"><Square className="h-4 w-4" /> <span className="font-mono text-xs text-muted-foreground">{task.key}</span> {task.title}</span>
        <span className="rounded-full border px-2 py-0.5 text-xs">{task.workflowStatus?.name}</span>
      </Link>)}
      {!subtasks.length && <p className="text-sm text-muted-foreground">No sub-tasks yet.</p>}
    </div>
  </div>;
}
