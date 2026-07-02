import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/utils/formatters';
import { useDeleteWorklog } from '@/hooks/useWorklogs';
import type { Worklog } from '@/types';
import { WorklogForm } from './WorklogForm';

function endTime(log: Worklog) {
  return new Date(new Date(log.dateStarted).getTime() + log.timeSpent * 1000);
}

function shortTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function humanDuration(seconds = 0) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  if (minutes) return `${minutes}m`;
  return '< 1m';
}

export function WorklogList({ issueId, worklogs = [] }: { issueId: string; worklogs?: Worklog[] }) {
  const [editing, setEditing] = useState<Worklog | null>(null);
  const remove = useDeleteWorklog(issueId);

  if (!worklogs.length) return <EmptyState title="No work logged" description="Start a timer or log work manually by start and end time." />;

  return (
    <div className="space-y-2">
      {worklogs.map((log) => {
        const end = endTime(log);
        return (
          <div key={log.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{log.user?.name ?? log.user?.email ?? 'User'}</div>
                <div className="text-muted-foreground">{log.description ?? 'No description'} · {formatDate(log.dateStarted)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Interval: {shortTime(log.dateStarted)} → {shortTime(end)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 font-medium">{humanDuration(log.timeSpent)}</span>
                <Button size="icon" variant="ghost" onClick={() => setEditing(log)} title="Edit worklog"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => window.confirm('Delete this worklog?') && remove.mutate(log.id)} disabled={remove.isPending} title="Delete worklog"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        );
      })}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit worklog interval</DialogTitle></DialogHeader>
          {editing && <WorklogForm issueId={issueId} worklog={editing} onSaved={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
