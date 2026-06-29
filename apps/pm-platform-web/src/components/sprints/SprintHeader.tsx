import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/formatters';
import type { Sprint } from '@/types';
export function SprintHeader({ sprint, onStart, onComplete }: { sprint: Sprint; onStart?: () => void; onComplete?: () => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">{sprint.name}</h2><Badge>{sprint.status}</Badge></div><p className="text-sm text-muted-foreground">{sprint.goal || 'No sprint goal'} · {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}</p></div><div className="flex gap-2"><Button variant="outline" onClick={onStart}>Start</Button><Button onClick={onComplete}>Complete</Button></div></div>; }
