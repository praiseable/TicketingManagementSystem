import { EmptyState } from '@/components/common/EmptyState';
import { formatDate, formatDuration } from '@/utils/formatters';
import type { Worklog } from '@/types';
export function WorklogList({ worklogs = [] }: { worklogs?: Worklog[] }) { if (!worklogs.length) return <EmptyState title="No work logged" description="Start a timer or log work manually." />; return <div className="space-y-2">{worklogs.map((log) => <div key={log.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><div><div className="font-medium">{log.user?.name ?? 'User'}</div><div className="text-muted-foreground">{log.description ?? 'No description'} · {formatDate(log.dateStarted)}</div></div><span className="font-mono">{formatDuration(log.timeSpent)}</span></div>)}</div>; }
