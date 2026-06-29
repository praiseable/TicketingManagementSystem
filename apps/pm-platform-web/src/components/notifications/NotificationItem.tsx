import { timeAgo } from '@/utils/formatters';
import type { Notification } from '@/types';
export function NotificationItem({ item }: { item: Notification }) { return <div className={`rounded-md border p-3 ${item.isRead ? 'opacity-70' : 'bg-primary/5'}`}><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{item.title}</h4><span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.body}</p></div>; }
