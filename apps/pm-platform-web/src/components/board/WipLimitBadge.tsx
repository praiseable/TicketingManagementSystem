import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
export function WipLimitBadge({ count, limit }: { count: number; limit?: number | null }) { if (!limit) return null; const hit = count >= limit; return <Badge className={cn('text-xs', hit ? 'border-red-300 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted')}>{count}/{limit}</Badge>; }
