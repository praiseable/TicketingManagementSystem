import { Badge } from '@/components/ui/badge';
import type { WorkflowStatus } from '@/types';
export function StatusBadge({ status }: { status?: WorkflowStatus }) { if (!status) return <Badge>Unknown</Badge>; return <Badge className="gap-1"><span className="h-2 w-2 rounded-full" style={{ background: status.color }} />{status.name}</Badge>; }
