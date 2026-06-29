import { useMemo, useState } from 'react';
import { Bell, Inbox, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useMarkNotificationRead, useNotificationPrefs, useNotifications, useReadAllNotifications, useUpdateNotificationPrefs } from '@/hooks/useNotifications';

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useNotifications({ unreadOnly, page: 1, limit: 100 });
  const markRead = useMarkNotificationRead();
  const readAll = useReadAllNotifications();
  const prefs = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const items = data?.data ?? [];
  const unreadCount = useMemo(() => items.filter((item: any) => !item.isRead).length, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold"><Bell className="h-7 w-7" /> Notifications</h1>
          <p className="text-sm text-muted-foreground">Review assignment, mention, issue, sprint, and documentation updates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={unreadOnly ? 'default' : 'outline'} onClick={() => setUnreadOnly((v) => !v)}>
            {unreadOnly ? 'Showing unread' : 'Show unread only'}
          </Button>
          <Button onClick={() => readAll.mutate()} disabled={!unreadCount || readAll.isPending}>Mark all read</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Total</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{data?.meta?.total ?? items.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Unread on page</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{unreadCount}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{unreadOnly ? 'Unread notifications only' : 'All notifications'}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> Notification timeline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">Loading notifications…</div>}
          {!isLoading && !items.length && <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No notifications found.</div>}
          {items.map((item: any) => <NotificationItem key={item.id} item={item} onRead={(id) => markRead.mutate(id)} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Notification preferences</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(prefs.data ?? []).map((pref: any) => (
            <div key={pref.eventType} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span className="font-medium">{pref.eventType}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(pref.inApp)} onChange={(e) => updatePrefs.mutate([{ ...pref, inApp: e.target.checked }])} /> In-app</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(pref.email)} onChange={(e) => updatePrefs.mutate([{ ...pref, email: e.target.checked }])} /> Email</label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
