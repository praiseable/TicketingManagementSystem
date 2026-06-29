import { Button } from '@/components/ui/button';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useNotifications, useReadAllNotifications } from '@/hooks/useNotifications';
export function NotificationsPage() { const { data } = useNotifications(); const readAll = useReadAllNotifications(); const items = data?.data ?? []; return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Notifications</h1><Button onClick={() => readAll.mutate()}>Mark all read</Button></div><div className="space-y-2">{items.map((item) => <NotificationItem key={item.id} item={item} />)}</div></div>; }
