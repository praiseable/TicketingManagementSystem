import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BulkActionBar({
  count,
  onClear,
  onApply,
  statuses = [],
  members = []
}: {
  count: number;
  onClear: () => void;
  onApply: (action: string, value?: unknown) => void;
  statuses?: Array<{ id: string; name: string }>;
  members?: Array<{ user?: { id: string; name: string; email: string }; userId?: string; role?: string }>;
}) {
  const [action, setAction] = useState('PRIORITY');
  const [value, setValue] = useState('HIGH');
  if (!count) return null;

  const apply = () => onApply(action, value);

  return <div className="fixed bottom-6 left-1/2 z-40 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border bg-background px-4 py-3 shadow-2xl">
    <span className="text-sm font-medium">{count} selected</span>
    <select className="h-9 rounded-md border bg-background px-2 text-sm" value={action} onChange={(e) => { setAction(e.target.value); setValue(e.target.value === 'PRIORITY' ? 'HIGH' : ''); }}>
      <option value="PRIORITY">Priority</option>
      <option value="STATUS">Status</option>
      <option value="ASSIGN">Assignee</option>
      <option value="LABEL">Labels</option>
      <option value="DELETE">Delete</option>
    </select>
    {action === 'PRIORITY' && <select className="h-9 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)}>{['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map((p) => <option key={p}>{p}</option>)}</select>}
    {action === 'STATUS' && <select className="h-9 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Select status</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
    {action === 'ASSIGN' && <select className="h-9 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Unassigned</option>{members.map((m) => <option key={m.user?.id ?? m.userId} value={m.user?.id ?? m.userId}>{m.user?.name ?? m.user?.email ?? m.userId}</option>)}</select>}
    {action === 'LABEL' && <Input className="h-9 w-48" placeholder="label-one,label-two" value={value} onChange={(e) => setValue(e.target.value)} />}
    <Button size="sm" variant="outline" onClick={onClear}>Clear</Button>
    <Button size="sm" variant={action === 'DELETE' ? 'destructive' : 'default'} onClick={apply}>Apply</Button>
  </div>;
}
