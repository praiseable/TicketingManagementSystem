import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate, formatDuration } from '@/utils/formatters';
import { useDeleteWorklog } from '@/hooks/useWorklogs';
import type { Worklog } from '@/types';
import { WorklogForm } from './WorklogForm';

export function WorklogList({ issueId, worklogs = [] }: { issueId: string; worklogs?: Worklog[] }) {
  const [editing, setEditing] = useState<Worklog | null>(null);
  const remove = useDeleteWorklog(issueId);

  if (!worklogs.length) return <EmptyState title="No work logged" description="Start a timer or log work manually." />;

  return <div className="space-y-2">
    {worklogs.map((log) => <div key={log.id} className="rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{log.user?.name ?? log.user?.email ?? 'User'}</div>
          <div className="text-muted-foreground">{log.description ?? 'No description'} · {formatDate(log.dateStarted)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono">{formatDuration(log.timeSpent)}</span>
          <Button size="icon" variant="ghost" onClick={() => setEditing(log)} title="Edit worklog"><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => remove.mutate(log.id)} disabled={remove.isPending} title="Delete worklog"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>)}
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit worklog</DialogTitle></DialogHeader>
        {editing && <WorklogForm issueId={issueId} worklog={editing} onSaved={() => setEditing(null)} />}
      </DialogContent>
    </Dialog>
  </div>;
}
