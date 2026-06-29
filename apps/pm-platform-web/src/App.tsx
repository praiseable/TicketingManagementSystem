import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectListPage = lazy(() => import('@/pages/projects/ProjectListPage').then((m) => ({ default: m.ProjectListPage })));
const ProjectSettingsPage = lazy(() => import('@/pages/projects/ProjectSettingsPage').then((m) => ({ default: m.ProjectSettingsPage })));
const BoardPage = lazy(() => import('@/pages/board/BoardPage').then((m) => ({ default: m.BoardPage })));
const BacklogPage = lazy(() => import('@/pages/backlog/BacklogPage').then((m) => ({ default: m.BacklogPage })));
const IssueListPage = lazy(() => import('@/pages/issues/IssueListPage').then((m) => ({ default: m.IssueListPage })));
const IssueDetailPage = lazy(() => import('@/pages/issues/IssueDetailPage').then((m) => ({ default: m.IssueDetailPage })));
const SprintsPage = lazy(() => import('@/pages/sprints/SprintsPage').then((m) => ({ default: m.SprintsPage })));
const MyPerformancePage = lazy(() => import('@/pages/performance/MyPerformancePage').then((m) => ({ default: m.MyPerformancePage })));
const TeamPerformancePage = lazy(() => import('@/pages/performance/TeamPerformancePage').then((m) => ({ default: m.TeamPerformancePage })));
const TimeReportPage = lazy(() => import('@/pages/reports/TimeReportPage').then((m) => ({ default: m.TimeReportPage })));
const SearchPage = lazy(() => import('@/pages/search/SearchPage').then((m) => ({ default: m.SearchPage })));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const SpaceListPage = lazy(() => import('@/pages/docs/SpaceListPage').then((m) => ({ default: m.SpaceListPage })));
const SpacePage = lazy(() => import('@/pages/docs/SpacePage').then((m) => ({ default: m.SpacePage })));
const PageEditorPage = lazy(() => import('@/pages/docs/PageEditorPage').then((m) => ({ default: m.PageEditorPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="grid min-h-[320px] place-items-center text-sm text-muted-foreground">Loading page…</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Page><LoginPage /></Page>} />
              <Route path="/register" element={<Page><RegisterPage /></Page>} />
              <Route path="/forgot-password" element={<Page><ForgotPasswordPage /></Page>} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
                <Route path="/projects" element={<Page><ProjectListPage /></Page>} />
                <Route path="/projects/:id/settings" element={<Page><ProjectSettingsPage /></Page>} />
                <Route path="/projects/:id/board" element={<Page><BoardPage /></Page>} />
                <Route path="/projects/:id/backlog" element={<Page><BacklogPage /></Page>} />
                <Route path="/projects/:id/issues" element={<Page><IssueListPage /></Page>} />
                <Route path="/projects/:id/issues/:issueId" element={<Page><IssueDetailPage /></Page>} />
                <Route path="/projects/:id/sprints" element={<Page><SprintsPage /></Page>} />
                <Route path="/performance/me" element={<Page><MyPerformancePage /></Page>} />
                <Route path="/performance/team" element={<Page><TeamPerformancePage /></Page>} />
                <Route path="/reports/time" element={<Page><TimeReportPage /></Page>} />
                <Route path="/search" element={<Page><SearchPage /></Page>} />
                <Route path="/notifications" element={<Page><NotificationsPage /></Page>} />
                <Route path="/admin/users" element={<Page><AdminUsersPage /></Page>} />
                <Route path="/admin/audit" element={<Page><AdminAuditPage /></Page>} />
                <Route path="/spaces" element={<Page><SpaceListPage /></Page>} />
                <Route path="/spaces/:spaceId" element={<Page><SpacePage /></Page>} />
                <Route path="/spaces/:spaceId/pages/:pageId" element={<Page><PageEditorPage /></Page>} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
