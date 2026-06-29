import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Plus, Trash2, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { issuesApi } from '@/api/issues.api';
import { queryKeys } from '@/api/queryKeys';
import type { Issue, IssueLink } from '@/types';

const linkTypes = ['BLOCKS', 'BLOCKED_BY', 'DUPLICATES', 'DUPLICATED_BY', 'RELATES_TO', 'CLONES'];
function label(type: string) { return type.toLowerCase().replace(/_/g, ' '); }

export function IssueLinks({ projectId, issue }: { projectId: string; issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [type, setType] = useState('RELATES_TO');
  const qc = useQueryClient();
  const outgoing = issue.sourceLinks ?? [];
  const incoming = issue.targetLinks ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.issue(issue.id) });
  const create = useMutation({
    mutationFn: () => issuesApi.link(projectId, issue.id, target.includes('-') ? { targetIssueKey: target.trim(), type } : { targetIssueId: target.trim(), type }),
    onSuccess: () => { setTarget(''); setOpen(false); refresh(); }
  });
  const remove = useMutation({ mutationFn: (linkId: string) => issuesApi.unlink(projectId, issue.id, linkId), onSuccess: refresh });

  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">Issue links <span className="text-xs text-muted-foreground">({outgoing.length + incoming.length})</span></h3>
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? 'Cancel' : 'Add link'}</Button>
    </div>
    {open && <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
      <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{linkTypes.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select>
      <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target issue key, e.g. PM-12" />
      <Button disabled={!target.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Linking…' : 'Link'}</Button>
    </div>}
    <div className="space-y-2">
      {outgoing.map((link: IssueLink) => <div key={link.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
        <Link to={`/projects/${projectId}/issues/${link.targetIssue?.id ?? link.targetIssueId}`} className="flex items-center gap-2 hover:underline"><Link2 className="h-4 w-4" /> <span className="capitalize text-muted-foreground">{label(link.type)}</span> <span className="font-mono">{link.targetIssue?.key}</span> {link.targetIssue?.title}</Link>
        <Button size="icon" variant="ghost" onClick={() => remove.mutate(link.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      {incoming.map((link: IssueLink) => <div key={link.id} className="flex items-center gap-2 rounded-md border p-2 text-sm text-muted-foreground"><Link2 className="h-4 w-4" /> Linked from <Link to={`/projects/${projectId}/issues/${link.sourceIssue?.id ?? link.sourceIssueId}`} className="font-mono hover:underline">{link.sourceIssue?.key}</Link> as {label(link.type)}</div>)}
      {!outgoing.length && !incoming.length && <p className="text-sm text-muted-foreground">No linked issues.</p>}
    </div>
  </div>;
}
