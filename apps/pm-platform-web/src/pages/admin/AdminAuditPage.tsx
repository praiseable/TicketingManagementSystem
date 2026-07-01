import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, Search } from 'lucide-react';
import { adminApi } from '@/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/utils/formatters';

export function AdminAuditPage() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const filters = useMemo(() => ({ page, limit: 50, q, action, entityType, entityId, from, to }), [page, q, action, entityType, entityId, from, to]);
  const audit = useQuery({ queryKey: ['audit', filters], queryFn: () => adminApi.auditLog(filters) });
  function submit(event: FormEvent) { event.preventDefault(); setPage(1); void audit.refetch(); }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold tracking-tight">Audit log</h1><p className="text-sm text-muted-foreground">Review administrative and system activity with user, action, entity, and date filters.</p></div><form className="grid gap-3 rounded-lg border p-4 md:grid-cols-3 xl:grid-cols-6" onSubmit={submit}><div className="space-y-1 xl:col-span-2"><Label>Search</Label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="action, entity, user" /></div></div><div className="space-y-1"><Label>Action</Label><Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="admin.user" /></div><div className="space-y-1"><Label>Entity</Label><Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="user, issue" /></div><div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div><div className="space-y-1 md:col-span-3 xl:col-span-6"><Label>Entity ID</Label><Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="optional UUID or entity id" /></div><div className="md:col-span-3 xl:col-span-6"><Button type="submit"><FileSearch className="h-4 w-4" /> Apply filters</Button></div></form><div className="space-y-3">{audit.data?.data.map((log) => <Card key={log.id}><CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">{log.action}</CardTitle><Badge>{log.entityType}</Badge></div></CardHeader><CardContent className="space-y-2 text-sm"><div className="grid gap-1 text-muted-foreground md:grid-cols-2"><div>User: {log.user?.email ?? 'system'}</div><div>When: {formatDate(log.createdAt)}</div><div>Entity ID: <span className="font-mono text-xs">{log.entityId}</span></div><div>IP: {log.ipAddress ?? 'n/a'}</div></div><details className="rounded-md bg-muted/40 p-2"><summary className="cursor-pointer text-xs font-semibold">Old / new data</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ oldData: log.oldData, newData: log.newData }, null, 2)}</pre></details></CardContent></Card>)}{!audit.data?.data.length && <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No audit logs found.</div>}</div><div className="flex items-center justify-between text-sm text-muted-foreground"><div>Total: {audit.data?.meta?.total ?? 0}</div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={(audit.data?.meta?.totalPages ?? 1) <= page} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div></div>;
}
