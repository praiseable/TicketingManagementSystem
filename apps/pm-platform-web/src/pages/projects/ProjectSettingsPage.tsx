import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { projectsApi } from '@/api/projects.api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const fieldTypes = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATETIME', 'DROPDOWN', 'MULTISELECT', 'USER', 'CHECKBOX', 'URL'];
const roles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const categories = ['TODO', 'IN_PROGRESS', 'DONE'];
const guardTypes = ['REQUIRED_FIELD', 'ASSIGNEE_SET', 'PERMISSION'];

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-4">{children}</div>;
}

export function ProjectSettingsPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', id] });
    qc.invalidateQueries({ queryKey: ['project-members', id] });
    qc.invalidateQueries({ queryKey: ['issue-types', id] });
    qc.invalidateQueries({ queryKey: ['custom-fields', id] });
    qc.invalidateQueries({ queryKey: ['workflows', id] });
  };

  const project = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id), enabled: Boolean(id) });
  const members = useQuery({ queryKey: ['project-members', id], queryFn: () => projectsApi.members(id), enabled: Boolean(id) });
  const types = useQuery({ queryKey: ['issue-types', id], queryFn: () => projectsApi.issueTypes(id), enabled: Boolean(id) });
  const fields = useQuery({ queryKey: ['custom-fields', id], queryFn: () => projectsApi.customFields(id), enabled: Boolean(id) });
  const workflows = useQuery({ queryKey: ['workflows', id], queryFn: () => projectsApi.workflows(id), enabled: Boolean(id) });

  const [message, setMessage] = useState('');
  const [general, setGeneral] = useState({ name: '', description: '' });
  const [invite, setInvite] = useState({ email: '', role: 'MEMBER' });
  const [issueType, setIssueType] = useState({ name: '', color: '#64748b', icon: 'circle' });
  const [customField, setCustomField] = useState({ name: '', key: '', type: 'TEXT', options: '', isRequired: false });
  const [workflow, setWorkflow] = useState({ name: '' });
  const [status, setStatus] = useState({ workflowId: '', name: '', category: 'TODO', color: '#64748b', wipLimit: '' });
  const [transition, setTransition] = useState({ workflowId: '', fromStatusId: '', toStatusId: '', name: '' });
  const [guard, setGuard] = useState({ workflowId: '', transitionId: '', type: 'REQUIRED_FIELD', fieldId: '', minRole: 'MEMBER' });

  const allTransitions = useMemo(() => (workflows.data ?? []).flatMap((wf: any) => (wf.transitions ?? []).map((tr: any) => ({ ...tr, workflowId: wf.id, workflowName: wf.name }))), [workflows.data]);

  const updateProject = useMutation({ mutationFn: (body: any) => projectsApi.update(id, body), onSuccess: () => { setMessage('Project updated'); invalidate(); } });
  const inviteMember = useMutation({ mutationFn: () => projectsApi.invite(id, invite), onSuccess: () => { setInvite({ email: '', role: 'MEMBER' }); setMessage('Member invited/added'); invalidate(); } });
  const updateMember = useMutation({ mutationFn: ({ userId, role }: { userId: string; role: string }) => projectsApi.updateMember(id, userId, { role }), onSuccess: () => { setMessage('Member role updated'); invalidate(); } });
  const removeMember = useMutation({ mutationFn: (userId: string) => projectsApi.removeMember(id, userId), onSuccess: () => { setMessage('Member removed'); invalidate(); } });
  const createIssueType = useMutation({ mutationFn: () => projectsApi.createIssueType(id, issueType), onSuccess: () => { setIssueType({ name: '', color: '#64748b', icon: 'circle' }); setMessage('Issue type created'); invalidate(); } });
  const createCustomField = useMutation({ mutationFn: () => projectsApi.createCustomField(id, { ...customField, options: customField.options ? customField.options.split(',').map((x) => x.trim()).filter(Boolean) : [] }), onSuccess: () => { setCustomField({ name: '', key: '', type: 'TEXT', options: '', isRequired: false }); setMessage('Custom field created'); invalidate(); } });
  const createWorkflow = useMutation({ mutationFn: () => projectsApi.createWorkflow(id, workflow), onSuccess: () => { setWorkflow({ name: '' }); setMessage('Workflow created'); invalidate(); } });
  const createStatus = useMutation({ mutationFn: () => projectsApi.createStatus(id, status.workflowId, { name: status.name, category: status.category, color: status.color, wipLimit: status.wipLimit ? Number(status.wipLimit) : null }), onSuccess: () => { setStatus({ workflowId: '', name: '', category: 'TODO', color: '#64748b', wipLimit: '' }); setMessage('Workflow status created'); invalidate(); } });
  const createTransition = useMutation({ mutationFn: () => projectsApi.createTransition(id, transition.workflowId, { fromStatusId: transition.fromStatusId, toStatusId: transition.toStatusId, name: transition.name }), onSuccess: () => { setTransition({ workflowId: '', fromStatusId: '', toStatusId: '', name: '' }); setMessage('Workflow transition created'); invalidate(); } });
  const createGuard = useMutation({ mutationFn: () => projectsApi.createGuard(id, guard.workflowId, guard.transitionId, { type: guard.type, fieldId: guard.fieldId || null, config: guard.type === 'PERMISSION' ? { minRole: guard.minRole } : {} }), onSuccess: () => { setGuard({ workflowId: '', transitionId: '', type: 'REQUIRED_FIELD', fieldId: '', minRole: 'MEMBER' }); setMessage('Transition guard created'); invalidate(); } });

  if (project.isLoading) return <div>Loading project settings…</div>;
  if (project.error) return <div className="rounded-lg border border-destructive p-4 text-destructive">Failed to load project settings.</div>;

  const submit = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); setMessage(''); fn(); };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{project.data?.name ?? 'Project'} settings</h1>
        <p className="text-sm text-muted-foreground">Configure project members, custom fields, issue types, workflows, guards, WIP limits, webhooks, and integration settings.</p>
      </div>
      <Button variant="outline" asChild><Link to={`/projects/${id}/issues`}>Open issues</Link></Button>
    </div>
    {message && <div className="rounded-lg border bg-muted p-3 text-sm">{message}</div>}

    <Tabs defaultValue="general">
      <TabsList className="flex flex-wrap"><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="members">Members</TabsTrigger><TabsTrigger value="types">Issue types</TabsTrigger><TabsTrigger value="fields">Custom fields</TabsTrigger><TabsTrigger value="workflows">Workflows</TabsTrigger></TabsList>

      <TabsContent value="general"><Card><CardHeader><CardTitle>General</CardTitle></CardHeader><CardContent className="space-y-3"><form className="space-y-3" onSubmit={submit(() => updateProject.mutate({ name: general.name || project.data?.name, description: general.description || project.data?.description || '' }))}><Input placeholder={project.data?.name ?? 'Project name'} value={general.name} onChange={(e) => setGeneral((s) => ({ ...s, name: e.target.value }))} /><Textarea placeholder={project.data?.description ?? 'Description'} value={general.description} onChange={(e) => setGeneral((s) => ({ ...s, description: e.target.value }))} /><Button type="submit">Save general settings</Button></form></CardContent></Card></TabsContent>

      <TabsContent value="members"><Card><CardHeader><CardTitle>Members and roles</CardTitle></CardHeader><CardContent className="space-y-4"><form onSubmit={submit(() => inviteMember.mutate())}><FormRow><Input placeholder="email@example.gov.pk" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={invite.role} onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value }))}>{roles.map((r) => <option key={r}>{r}</option>)}</select><Button type="submit">Invite / add member</Button></FormRow></form><div className="rounded-lg border"><table className="w-full text-sm"><tbody>{(members.data ?? []).map((m: any) => <tr key={m.user?.id ?? m.userId} className="border-b"><td className="p-3">{m.user?.name}<br /><span className="text-xs text-muted-foreground">{m.user?.email}</span></td><td className="p-3"><select className="h-9 rounded-md border bg-background px-2" value={m.role} onChange={(e) => updateMember.mutate({ userId: m.user?.id ?? m.userId, role: e.target.value })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></td><td className="p-3 text-right"><Button size="sm" variant="destructive" onClick={() => removeMember.mutate(m.user?.id ?? m.userId)}>Remove</Button></td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>

      <TabsContent value="types"><Card><CardHeader><CardTitle>UC-18 issue types</CardTitle></CardHeader><CardContent className="space-y-4"><form onSubmit={submit(() => createIssueType.mutate())}><FormRow><Input placeholder="Epic / Change / Defect" value={issueType.name} onChange={(e) => setIssueType((s) => ({ ...s, name: e.target.value }))} /><Input placeholder="#64748b" value={issueType.color} onChange={(e) => setIssueType((s) => ({ ...s, color: e.target.value }))} /><Input placeholder="icon" value={issueType.icon} onChange={(e) => setIssueType((s) => ({ ...s, icon: e.target.value }))} /><Button type="submit">Create issue type</Button></FormRow></form><div className="grid gap-3 md:grid-cols-2">{(types.data ?? []).map((t: any) => <Card key={t.id}><CardContent className="pt-6"><div className="flex items-center justify-between"><div><div className="font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t._count?.issues ?? 0} issues · {t.fields?.length ?? 0} fields</div></div><Badge style={{ borderColor: t.color }}>{t.icon}</Badge></div></CardContent></Card>)}</div></CardContent></Card></TabsContent>

      <TabsContent value="fields"><Card><CardHeader><CardTitle>UC-17 custom fields</CardTitle></CardHeader><CardContent className="space-y-4"><form className="space-y-3" onSubmit={submit(() => createCustomField.mutate())}><FormRow><Input placeholder="Field name" value={customField.name} onChange={(e) => setCustomField((s) => ({ ...s, name: e.target.value }))} /><Input placeholder="field_key" value={customField.key} onChange={(e) => setCustomField((s) => ({ ...s, key: e.target.value }))} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={customField.type} onChange={(e) => setCustomField((s) => ({ ...s, type: e.target.value }))}>{fieldTypes.map((t) => <option key={t}>{t}</option>)}</select><Button type="submit">Create custom field</Button></FormRow><Input placeholder="Options for dropdown/multiselect, comma separated" value={customField.options} onChange={(e) => setCustomField((s) => ({ ...s, options: e.target.value }))} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={customField.isRequired} onChange={(e) => setCustomField((s) => ({ ...s, isRequired: e.target.checked }))} /> Required</label></form><div className="grid gap-3 md:grid-cols-2">{(fields.data ?? []).map((f: any) => <Card key={f.id}><CardContent className="pt-6"><div className="flex items-center justify-between"><div><div className="font-semibold">{f.name}</div><div className="text-xs text-muted-foreground">{f.key} · {f.type} · {f.isRequired ? 'required' : 'optional'}</div></div><Badge>{f._count?.values ?? 0} values</Badge></div></CardContent></Card>)}</div></CardContent></Card></TabsContent>

      <TabsContent value="workflows"><Card><CardHeader><CardTitle>UC-20 workflow builder and UC-21 guards</CardTitle></CardHeader><CardContent className="space-y-6"><form onSubmit={submit(() => createWorkflow.mutate())}><FormRow><Input placeholder="Workflow name" value={workflow.name} onChange={(e) => setWorkflow({ name: e.target.value })} /><Button type="submit">Create workflow</Button></FormRow></form><form onSubmit={submit(() => createStatus.mutate())}><FormRow><select className="h-10 rounded-md border bg-background px-3 text-sm" value={status.workflowId} onChange={(e) => setStatus((s) => ({ ...s, workflowId: e.target.value }))}><option value="">Select workflow</option>{(workflows.data ?? []).map((wf: any) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}</select><Input placeholder="Status name" value={status.name} onChange={(e) => setStatus((s) => ({ ...s, name: e.target.value }))} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={status.category} onChange={(e) => setStatus((s) => ({ ...s, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select><Input placeholder="WIP limit" value={status.wipLimit} onChange={(e) => setStatus((s) => ({ ...s, wipLimit: e.target.value }))} /><Button type="submit">Add status</Button></FormRow></form><form onSubmit={submit(() => createTransition.mutate())}><FormRow><select className="h-10 rounded-md border bg-background px-3 text-sm" value={transition.workflowId} onChange={(e) => setTransition((s) => ({ ...s, workflowId: e.target.value, fromStatusId: '', toStatusId: '' }))}><option value="">Workflow</option>{(workflows.data ?? []).map((wf: any) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={transition.fromStatusId} onChange={(e) => setTransition((s) => ({ ...s, fromStatusId: e.target.value }))}><option value="">From</option>{(workflows.data ?? []).find((wf: any) => wf.id === transition.workflowId)?.statuses?.map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={transition.toStatusId} onChange={(e) => setTransition((s) => ({ ...s, toStatusId: e.target.value }))}><option value="">To</option>{(workflows.data ?? []).find((wf: any) => wf.id === transition.workflowId)?.statuses?.map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}</select><Input placeholder="Transition name" value={transition.name} onChange={(e) => setTransition((s) => ({ ...s, name: e.target.value }))} /><Button type="submit">Add transition</Button></FormRow></form><form onSubmit={submit(() => createGuard.mutate())}><FormRow><select className="h-10 rounded-md border bg-background px-3 text-sm" value={guard.transitionId} onChange={(e) => { const tr = allTransitions.find((x: any) => x.id === e.target.value); setGuard((s) => ({ ...s, transitionId: e.target.value, workflowId: tr?.workflowId ?? '' })); }}><option value="">Transition</option>{allTransitions.map((tr: any) => <option key={tr.id} value={tr.id}>{tr.workflowName}: {tr.fromStatus?.name} → {tr.toStatus?.name}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={guard.type} onChange={(e) => setGuard((s) => ({ ...s, type: e.target.value }))}>{guardTypes.map((g) => <option key={g}>{g}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={guard.fieldId} onChange={(e) => setGuard((s) => ({ ...s, fieldId: e.target.value }))}><option value="">Custom field</option>{(fields.data ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={guard.minRole} onChange={(e) => setGuard((s) => ({ ...s, minRole: e.target.value }))}>{roles.map((r) => <option key={r}>{r}</option>)}</select><Button type="submit">Add guard</Button></FormRow></form><div className="grid gap-4">{(workflows.data ?? []).map((wf: any) => <Card key={wf.id}><CardContent className="space-y-3 pt-6"><div className="font-semibold">{wf.name} {wf.isDefault && <Badge>Default</Badge>}</div><div className="flex flex-wrap gap-2">{wf.statuses?.map((st: any) => <Badge key={st.id}>{st.name} · {st.category}{st.wipLimit ? ` · WIP ${st.wipLimit}` : ''}</Badge>)}</div><div className="space-y-2 text-sm">{wf.transitions?.map((tr: any) => <div key={tr.id} className="rounded-md border p-2"><b>{tr.name}</b>: {tr.fromStatus?.name} → {tr.toStatus?.name}<div className="mt-1 text-xs text-muted-foreground">Guards: {(tr.guards ?? []).map((g: any) => `${g.type}${g.field?.name ? `(${g.field.name})` : ''}`).join(', ') || 'none'}</div></div>)}</div></CardContent></Card>)}</div></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}
