import { Outlet } from 'react-router-dom';
export function DocsLayout() { return <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 gap-4 md:grid-cols-[280px_1fr]"><Outlet /></div>; }
