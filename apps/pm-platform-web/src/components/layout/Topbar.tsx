import { Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuthStore } from '@/stores/auth.store';
import { useTimerStore } from '@/stores/timer.store';
import { useUiStore } from '@/stores/ui.store';
import { formatDuration } from '@/utils/formatters';

export function Topbar() {
  const ui = useUiStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeTimer = useTimerStore((s) => s.activeTimer());
  return <header className="flex h-14 items-center justify-between border-b bg-background px-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={ui.toggleSidebar}><Menu className="h-5 w-5" /></Button><Button variant="outline" className="hidden w-64 justify-start text-muted-foreground md:flex" onClick={() => ui.setCommandOpen(true)}><Search className="mr-2 h-4 w-4" />Search or jump to…</Button>{activeTimer && <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Timer {formatDuration(activeTimer.elapsedSeconds ?? activeTimer.accumulatedSeconds)}</div>}</div><div className="flex items-center gap-2"><NotificationBell /><Button variant="ghost" size="icon" onClick={ui.toggleTheme}>{ui.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button><span className="hidden text-sm text-muted-foreground md:inline">{user?.name}</span><Button variant="ghost" onClick={logout}>Logout</Button></div></header>;
}
