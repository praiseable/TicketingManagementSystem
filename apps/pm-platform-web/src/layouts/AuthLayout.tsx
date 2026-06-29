import { Outlet } from 'react-router-dom';
export function AuthLayout() { return <div className="grid min-h-screen place-items-center bg-muted/40 p-4"><div className="w-full max-w-md"><Outlet /></div></div>; }
