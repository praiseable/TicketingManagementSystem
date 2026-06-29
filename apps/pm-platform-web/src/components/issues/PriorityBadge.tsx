import { Badge } from '@/components/ui/badge';
import { priorityConfig } from '@/utils/priorities';
import type { Priority } from '@/types';
export function PriorityBadge({ priority }: { priority: Priority }) { const config = priorityConfig[priority]; const Icon = config.icon; return <Badge className={config.className}><Icon className="mr-1 h-3 w-3" />{config.label}</Badge>; }
