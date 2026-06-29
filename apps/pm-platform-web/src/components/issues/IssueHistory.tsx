import { timeAgo } from '@/utils/formatters';
import type { IssueHistory as History } from '@/types';
export function IssueHistory({ history = [] }: { history?: History[] }) { return <div className="space-y-3">{history.map((item) => <div key={item.id} className="border-l-2 pl-3 text-sm"><div className="font-medium">{item.field} changed</div><div className="text-muted-foreground">{item.oldValue ?? 'empty'} → {item.newValue ?? 'empty'} · {timeAgo(item.createdAt)}</div></div>)}{!history.length && <p className="text-sm text-muted-foreground">No history yet.</p>}</div>; }
