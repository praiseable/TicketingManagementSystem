import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell() { const { data } = useNotifications(); const items = data?.data ?? []; const unread = items.filter((n) => !n.isRead).length; return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative"><Bell className="h-4 w-4" />{unread > 0 && <motion.span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white" animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: 2 }}>{unread}</motion.span>}</Button></PopoverTrigger><PopoverContent className="w-96"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Notifications</h3><Link to="/notifications" className="text-xs text-primary">View all</Link></div><div className="max-h-80 space-y-2 overflow-y-auto">{items.slice(0, 5).map((item) => <NotificationItem key={item.id} item={item} />)}{!items.length && <p className="py-8 text-center text-sm text-muted-foreground">No notifications</p>}</div></PopoverContent></Popover>; }
