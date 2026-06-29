import { useQuery } from '@tanstack/react-query';
import { api, unwrapWithMeta } from '@/api/client';
import { formatDate } from '@/utils/formatters';
export function AdminAuditPage() { const { data } = useQuery({ queryKey: ['audit'], queryFn: () => api.get('/admin/audit-log').then(unwrapWithMeta<any[]>) }); return <div className="space-y-4"><h1 className="text-3xl font-bold">Audit log</h1><div className="space-y-2">{data?.data.map((log) => <div key={log.id} className="rounded-lg border p-3 text-sm"><div className="font-semibold">{log.action}</div><div className="text-muted-foreground">{log.entityType}:{log.entityId} · {formatDate(log.createdAt)}</div></div>)}</div></div>; }
