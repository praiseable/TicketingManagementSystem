import { Outlet, useParams } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useSocket } from '@/hooks/useSocket';

export function AppLayout() { const params = useParams(); useSocket(params.id); return <div className="flex min-h-screen"><Sidebar /><div className="flex min-w-0 flex-1 flex-col"><Topbar /><main className="flex-1 overflow-auto p-4 md:p-6"><ErrorBoundary><Outlet /></ErrorBoundary></main></div><CommandPalette /></div>; }
