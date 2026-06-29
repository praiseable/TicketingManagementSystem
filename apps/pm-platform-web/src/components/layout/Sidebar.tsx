import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Bell, FolderKanban, Gauge, Home, Search, Settings, Users, FileText } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUiStore } from '@/stores/ui.store';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/performance/me', label: 'My Performance', icon: Gauge },
  { to: '/performance/team', label: 'Team', icon: BarChart3 },
  { to: '/reports/time', label: 'Reports', icon: FileText },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/users', label: 'Admin', icon: Users },
  { to: '/spaces', label: 'Docs', icon: Settings }
];
export function Sidebar() { const open = useUiStore((s) => s.sidebarOpen); return <motion.aside animate={{ width: open ? 240 : 64 }} className="hidden border-r bg-card md:block"><div className="p-4 text-lg font-bold">{open ? 'PM Platform' : 'PM'}</div><nav className="space-y-1 px-2">{items.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent', isActive && 'bg-accent font-medium')}><item.icon className="h-4 w-4" />{open && item.label}</NavLink>)}</nav></motion.aside>; }
