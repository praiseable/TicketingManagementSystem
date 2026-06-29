import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
export function ProtectedRoute() { const authed = useAuthStore((s) => s.isAuthenticated); return authed ? <Outlet /> : <Navigate to="/login" replace />; }
