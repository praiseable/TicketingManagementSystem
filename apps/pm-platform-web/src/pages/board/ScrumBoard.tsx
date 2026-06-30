import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { IssueCard } from '@/components/issues/IssueCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSprints } from '@/hooks/useSprints';

export function ScrumBoard() {
  const { id = '' } = useParams();
  const { data } = useSprints(id);
  const active = data?.find((s) => s.status === 'ACTIVE');
  const grouped = useMemo(() => {
    const issues = active?.issues ?? [];
    return {
      todo: issues.filter((issue) => issue.workflowStatus?.category === 'TODO'),
      progress: issues.filter((issue) => issue.workflowStatus?.category === 'IN_PROGRESS'),
      done: issues.filter((issue) => issue.workflowStatus?.category === 'DONE')
    };
  }, [active]);

  if (!active) return <EmptyState title="No active sprint" description="Start a sprint to use the Scrum board." />;

  const columns = [
    ['Todo', grouped.todo],
    ['In progress', grouped.progress],
    ['Done', grouped.done]
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{active.name}</h1><p className="text-sm text-muted-foreground">{active.goal || 'No sprint goal defined'}</p></div>
        <div className="flex gap-2"><Badge>{active.issues?.length ?? 0} issues</Badge><Badge>{active.committedStoryPoints ?? 0} committed pts</Badge><Badge>{active.completedStoryPoints ?? 0} done pts</Badge></div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {columns.map(([name, rows]) => (
          <Card key={name}>
            <CardHeader><CardTitle className="flex items-center justify-between"><span>{name}</span><Badge>{rows.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!rows.length && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No issues</div>}
              {rows.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
