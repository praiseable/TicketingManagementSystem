import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardCard } from './BoardCard';
import { WipLimitBadge } from './WipLimitBadge';
import type { Issue, WorkflowStatus } from '@/types';

export function BoardColumn({
  status,
  issues,
  onNewIssue,
  isSaving
}: {
  status: WorkflowStatus;
  issues: Issue[];
  onNewIssue: (status: WorkflowStatus) => void;
  isSaving?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id, data: { status } });
  const isWipBreached = typeof status.wipLimit === 'number' && issues.length >= status.wipLimit;

  return (
    <motion.section
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className={`flex min-h-[560px] w-[21rem] shrink-0 flex-col rounded-2xl border p-3 shadow-sm backdrop-blur transition-all duration-200 ${
        isOver ? 'scale-[1.015] border-primary/50 bg-primary/10 shadow-xl ring-2 ring-primary/20' : 'bg-muted/40'
      } ${isWipBreached ? 'border-red-300 bg-red-50/70 dark:bg-red-950/20' : ''}`}
    >
      <header className="mb-3 rounded-xl border bg-background/80 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full shadow" style={{ background: status.color }} />
            <div>
              <h3 className="font-semibold leading-none">{status.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{issues.length} card{issues.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <WipLimitBadge count={issues.length} limit={status.wipLimit} />
          </div>
        </div>
      </header>

      <SortableContext items={issues.map((issue) => issue.id)} strategy={verticalListSortingStrategy}>
        <motion.div layout className="flex flex-1 flex-col gap-3">
          <AnimatePresence initial={false}>
            {issues.map((issue) => <BoardCard key={issue.id} issue={issue} />)}
          </AnimatePresence>
          {!issues.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid min-h-[120px] place-items-center rounded-xl border border-dashed bg-background/50 p-4 text-center text-xs text-muted-foreground"
            >
              Drop a card here
            </motion.div>
          )}
        </motion.div>
      </SortableContext>

      <Button variant="ghost" className="mt-3 justify-start rounded-xl border border-dashed bg-background/60" onClick={() => onNewIssue(status)}>
        <Plus className="h-4 w-4" /> New issue
      </Button>
    </motion.section>
  );
}

