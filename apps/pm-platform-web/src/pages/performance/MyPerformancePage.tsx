import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Clock, GitCommit, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/performance/MetricCard';
import { CompletionRateChart } from '@/components/performance/CompletionRateChart';
import { TimeLoggedChart } from '@/components/performance/TimeLoggedChart';
import { useMyPerformance } from '@/hooks/usePerformance';

function activityIcon(type: string) {
  if (type === 'worklog') return <Clock className="h-4 w-4" />;
  if (type === 'comment') return <MessageCircle className="h-4 w-4" />;
  return <GitCommit className="h-4 w-4" />;
}

export function MyPerformancePage() {
  const [range, setRange] = useState('month');
  const { data, isLoading } = useMyPerformance({ period: range });
  const summary = data?.summary ?? { issuesAssigned: 0, issuesCompleted: 0, timeLoggedSeconds: 0, hoursLogged: 0, onTimePct: 0, estimateAccuracyPct: 0, storyPointsDelivered: 0, worklogCount: 0 };
  const timeData = useMemo(() => (data?.dailyTime ?? []).map((row) => ({ date: row.date.slice(5), hours: row.hours })), [data]);
  const last = data?.snapshots?.[1];
  const storyDelta = last ? summary.storyPointsDelivered - last.storyPointsDelivered : summary.storyPointsDelivered;
  const accuracy = summary.estimateAccuracyPct ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My performance</h1>
          <p className="text-sm text-muted-foreground">Assigned work, completed work, logged time and delivery quality for the selected period.</p>
        </div>
        <div className="flex gap-2">{['week', 'month', 'quarter'].map((x) => <Button key={x} variant={range === x ? 'default' : 'outline'} onClick={() => setRange(x)}>{x}</Button>)}</div>
      </div>

      {isLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading performance data…</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Assigned" value={summary.issuesAssigned} />
        <MetricCard title="Completed" value={summary.issuesCompleted} />
        <MetricCard title="Hours logged" value={Math.round(summary.hoursLogged)} />
        <MetricCard title="On-time" value={Math.round(summary.onTimePct)} suffix="%" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CompletionRateChart assigned={summary.issuesAssigned} completed={summary.issuesCompleted} />
        <TimeLoggedChart data={timeData} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-lg border p-4 ${accuracy > 80 ? 'bg-green-50 dark:bg-green-950/20' : accuracy > 60 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
          <div className="text-sm text-muted-foreground">Estimate accuracy</div>
          <div className="text-2xl font-bold">{accuracy == null ? 'N/A' : `${Math.round(accuracy)}%`}</div>
          <p className="mt-1 text-xs text-muted-foreground">Compares logged time with estimated time for completed work.</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Story points delivered</div>
          <div className="flex items-center gap-2 text-2xl font-bold">{summary.storyPointsDelivered}{storyDelta >= 0 ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}</div>
          <p className="mt-1 text-xs text-muted-foreground">Delivered from issues currently completed in the selected range.</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Worklog entries</div>
          <div className="text-2xl font-bold">{summary.worklogCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Manual logs and timer-saved logs.</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="font-semibold">Recent activity</div>
        <div className="mt-3 space-y-2">
          {(data?.recentActivity ?? []).map((item, idx) => (
            <div key={`${item.type}-${item.at}-${idx}`} className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
              <div className="mt-0.5 text-muted-foreground">{activityIcon(item.type)}</div>
              <div>
                <div className="font-medium">{item.issue?.key ? `${item.issue.key}: ` : ''}{item.action}</div>
                <div className="text-muted-foreground">{item.detail ?? item.issue?.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {!(data?.recentActivity ?? []).length && <div className="text-sm text-muted-foreground">No recent activity for this period.</div>}
        </div>
      </div>
    </div>
  );
}
