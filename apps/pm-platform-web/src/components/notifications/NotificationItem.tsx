import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/utils/formatters';
import type { Notification } from '@/types';

export function NotificationItem({ item, onRead }: { item: Notification; onRead?: (id: string) => void }) {
  return (
    <div className={`rounded-lg border p-4 transition ${item.isRead ? 'opacity-75' : 'border-primary/30 bg-primary/5 shadow-sm'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{item.title}</h4>
            {!item.isRead && <Badge>Unread</Badge>}
            <Badge variant="outline">{item.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.body}</p>
          <div className="text-xs text-muted-foreground">{timeAgo(item.createdAt)} · {item.entityType}</div>
        </div>
        {!item.isRead && onRead && (
          <Button type="button" size="sm" variant="outline" onClick={() => onRead(item.id)}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Mark read
          </Button>
        )}
      </div>
    </div>
  );
}
