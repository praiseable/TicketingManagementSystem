import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WorklogForm } from './WorklogForm';
import { useTimer } from '@/hooks/useTimer';
import { formatDuration } from '@/utils/formatters';
import { queryKeys } from '@/api/queryKeys';

export function LiveTimer({ issueId }: { issueId: string }) {
  const { timer, elapsed, start, pause, stop } = useTimer(issueId);
  const qc = useQueryClient();
  const [manualOpen, setManualOpen] = useState(false);

  async function handleStop() {
    await stop.mutateAsync();
    qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
    qc.invalidateQueries({ queryKey: queryKeys.worklogs(issueId) });
  }

  return <div className="rounded-xl border bg-card p-4">
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold">Live timer</div>
        <div className="text-xs text-muted-foreground">Redis-backed timer, saved as a worklog on stop.</div>
      </div>
      <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>Log work</Button>
    </div>
    <motion.div className="mb-4 font-mono text-3xl" animate={timer?.status === 'ACTIVE' ? { scale: [1, 1.03, 1] } : { scale: 1 }} transition={{ repeat: timer?.status === 'ACTIVE' ? Infinity : 0, duration: 1.2 }}>{formatDuration(elapsed)}</motion.div>
    <div className="flex flex-wrap gap-2">
      {!timer && <Button onClick={() => start.mutate()} disabled={start.isPending}><Play className="h-4 w-4" />Start</Button>}
      {timer?.status === 'PAUSED' && <Button onClick={() => start.mutate()} disabled={start.isPending}><RotateCcw className="h-4 w-4" />Resume</Button>}
      {timer?.status === 'ACTIVE' && <Button variant="outline" onClick={() => pause.mutate()} disabled={pause.isPending}><Pause className="h-4 w-4" />Pause</Button>}
      {timer && <Button variant="destructive" onClick={handleStop} disabled={stop.isPending}><Square className="h-4 w-4" />Stop & save</Button>}
    </div>
    {timer && <p className="mt-3 text-xs text-muted-foreground">Status: {timer.status}. Stopping creates a worklog and recalculates remaining estimate.</p>}
    {!timer && <p className="mt-3 text-xs text-muted-foreground">Start a timer or use Log work for manual entry. Timer action failed messages will appear if the server rejects the action.</p>}
    <Dialog open={manualOpen} onOpenChange={setManualOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log work</DialogTitle></DialogHeader>
        <WorklogForm issueId={issueId} defaultSeconds={1800} onSaved={() => { setManualOpen(false); qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) }); }} />
      </DialogContent>
    </Dialog>
  </div>;
}
