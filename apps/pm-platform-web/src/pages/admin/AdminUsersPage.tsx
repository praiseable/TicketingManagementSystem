import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Search, ShieldCheck, ShieldX, UserCog, UserX } from 'lucide-react';
import { adminApi } from '@/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/utils/formatters';

const roles = ['', 'SUPER_ADMIN', 'ADMIN', 'MEMBER'];
const activeStates = ['', 'true', 'false'];

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');
  const [resetResult, setResetResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filters = useMemo(() => ({ q, role, isActive, page: 1, limit: 100 }), [q, role, isActive]);
  const users = useQuery({ queryKey: ['admin-users', filters], queryFn: () => adminApi.users(filters) });
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats });

  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['admin-users'] }), qc.invalidateQueries({ queryKey: ['admin-stats'] }), qc.invalidateQueries({ queryKey: ['audit'] })]); };
  const activate = useMutation({ mutationFn: adminApi.activateUser, onSuccess: refresh, onError: (err: any) => setError(err?.response?.data?.error?.message ?? err.message) });
  const deactivate = useMutation({ mutationFn: adminApi.deactivateUser, onSuccess: refresh, onError: (err: any) => setError(err?.response?.data?.error?.message ?? err.message) });
  const changeRole = useMutation({ mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.changeUserRole(id, role), onSuccess: refresh, onError: (err: any) => setError(err?.response?.data?.error?.message ?? err.message) });
  const resetPassword = useMutation({ mutationFn: ({ id, password }: { id: string; password?: string }) => adminApi.resetUserPassword(id, password), onSuccess: async (data) => { setResetResult(data); await refresh(); }, onError: (err: any) => setError(err?.response?.data?.error?.message ?? err.message) });
  function submitSearch(event: FormEvent) { event.preventDefault(); void users.refetch(); }

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Admin users</h1><p className="text-sm text-muted-foreground">Manage users, activation status, global roles, and administrative password resets.</p></div>
    {stats.data && <div className="grid gap-3 md:grid-cols-4"><Card><CardHeader className="py-3"><CardTitle className="text-sm">Users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.data.totalUsers}</CardContent></Card><Card><CardHeader className="py-3"><CardTitle className="text-sm">Active</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">{stats.data.activeUsers}</CardContent></Card><Card><CardHeader className="py-3"><CardTitle className="text-sm">Projects</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.data.totalProjects}</CardContent></Card><Card><CardHeader className="py-3"><CardTitle className="text-sm">Audit logs</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.data.totalAuditLogs}</CardContent></Card></div>}
    <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_180px_180px_auto]" onSubmit={submitSearch}><div className="space-y-1"><Label>Search</Label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="name or email" /></div></div><div className="space-y-1"><Label>Role</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r} value={r}>{r || 'Any role'}</option>)}</select></div><div className="space-y-1"><Label>Status</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={isActive} onChange={(e) => setIsActive(e.target.value)}>{activeStates.map((s) => <option key={s} value={s}>{s === 'true' ? 'Active' : s === 'false' ? 'Inactive' : 'Any status'}</option>)}</select></div><div className="flex items-end"><Button type="submit">Apply</Button></div></form>
    {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
    {resetResult && <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Temporary password for {resetResult.email}: <code className="font-mono">{resetResult.temporaryPassword}</code></div>}
    <div className="overflow-hidden rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Activity</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{users.data?.data.map((u) => <tr key={u.id} className="border-t align-top"><td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div><div className="text-xs text-muted-foreground">Created {formatDate(u.createdAt)}</div></td><td className="p-3"><Badge>{u.role}</Badge></td><td className="p-3">{u.isActive ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Active</span> : <span className="inline-flex items-center gap-1 text-destructive"><ShieldX className="h-4 w-4" /> Inactive</span>}</td><td className="p-3 text-xs text-muted-foreground">Projects: {u._count?.projectMemberships ?? 0}<br />Assigned: {u._count?.assignedIssues ?? 0}<br />Worklogs: {u._count?.worklogs ?? 0}</td><td className="space-y-2 p-3 text-right"><div className="flex flex-wrap justify-end gap-2"><select className="h-9 rounded-md border bg-background px-2 text-xs" value={u.role} onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}><option value="MEMBER">MEMBER</option><option value="ADMIN">ADMIN</option><option value="SUPER_ADMIN">SUPER_ADMIN</option></select>{u.isActive ? <Button size="sm" variant="outline" onClick={() => deactivate.mutate(u.id)}><UserX className="h-3.5 w-3.5" /> Deactivate</Button> : <Button size="sm" variant="outline" onClick={() => activate.mutate(u.id)}><ShieldCheck className="h-3.5 w-3.5" /> Activate</Button>}<Button size="sm" variant="outline" onClick={() => resetPassword.mutate({ id: u.id })}><KeyRound className="h-3.5 w-3.5" /> Reset</Button></div></td></tr>)}{!users.data?.data.length && <tr><td className="p-6 text-center text-muted-foreground" colSpan={5}>No users found.</td></tr>}</tbody></table></div>
    <div className="flex items-center justify-between text-sm text-muted-foreground"><div>Total: {users.data?.meta?.total ?? 0}</div><div className="inline-flex items-center gap-2"><UserCog className="h-4 w-4" /> UC-49 admin user management</div></div>
  </div>;
}
