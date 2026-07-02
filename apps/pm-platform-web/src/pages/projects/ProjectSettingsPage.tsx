import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { projectsApi } from '@/api/projects.api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Feedback, FieldError } from '@/components/common/Feedback';
import { LoadingButton } from '@/components/common/LoadingButton';
import { fieldKeyFromName, getApiErrorMessage, isValidEmail, isValidFieldKey } from '@/lib/api-error';

const fieldTypes = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATETIME', 'DROPDOWN', 'MULTISELECT', 'USER', 'CHECKBOX', 'URL'];
const roles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const categories = ['TODO', 'IN_PROGRESS', 'DONE'];
const guardTypes = ['REQUIRED_FIELD', 'ASSIGNEE_SET', 'PERMISSION'];
const optionFieldTypes = new Set(['DROPDOWN', 'MULTISELECT']);

type Notice = { tone: 'success' | 'error' | 'warning' | 'info'; title?: string; message: string } | null;
type FormErrors = Record<string, string>;

function FormRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-4">{children}</div>;
}

function SelectBox(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 rounded-md border bg-background px-3 text-sm ${props.className ?? ''}`} />;
}

function normalizeTrim(value: string) {
  return value.trim();
}

function positiveNumberOrBlank(value: string) {
  if (!value.trim()) return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function ProjectSettingsPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<FormErrors>({});

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

  const [general, setGeneral] = useState({ name: '', description: '' });
  const [invite, setInvite] = useState({ email: '', role: 'MEMBER' });
  const [issueType, setIssueType] = useState({ name: '', color: '#64748b', icon: 'circle' });
  const [customField, setCustomField] = useState({ name: '', key: '', type: 'TEXT', options: '', isRequired: false });
  const [workflow, setWorkflow] = useState({ name: '' });
  const [status, setStatus] = useState({ workflowId: '', name: '', category: 'TODO', color: '#64748b', wipLimit: '' });
  const [transition, setTransition] = useState({ workflowId: '', fromStatusId: '', toStatusId: '', name: '' });
  const [guard, setGuard] = useState({ workflowId: '', transitionId: '', type: 'REQUIRED_FIELD', fieldId: '', minRole: 'MEMBER' });

  const allTransitions = useMemo(
    () => (workflows.data ?? []).flatMap((wf: any) => (wf.transitions ?? []).map((tr: any) => ({ ...tr, workflowId: wf.id, workflowName: wf.name }))),
    [workflows.data]
  );

  function setSuccess(message: string) {
    setNotice({ tone: 'success', title: 'Saved', message });
    setErrors({});
  }

  function setFailure(error: unknown, fallback: string) {
    setNotice({ tone: 'error', title: 'Action failed', message: getApiErrorMessage(error, fallback) });
  }

  function block(formErrors: FormErrors, title = 'Please check the form') {
    setErrors(formErrors);
    setNotice({ tone: 'error', title, message: Object.values(formErrors).join('\n') });
    return false;
  }

  const updateProject = useMutation({
    mutationFn: (body: any) => projectsApi.update(id, body),
    onSuccess: () => { setSuccess('Project settings updated successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not update project settings.'),
  });

  const inviteMember = useMutation({
    mutationFn: () => projectsApi.invite(id, { email: invite.email.trim(), role: invite.role }),
    onSuccess: () => { setInvite({ email: '', role: 'MEMBER' }); setSuccess('Member invited or added successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not add member.'),
  });

  const updateMember = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => projectsApi.updateMember(id, userId, { role }),
    onSuccess: () => { setSuccess('Member role updated successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not update member role.'),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => { setSuccess('Member removed successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not remove member.'),
  });

  const createIssueType = useMutation({
    mutationFn: () => projectsApi.createIssueType(id, { name: issueType.name.trim(), color: issueType.color || '#64748b', icon: issueType.icon || 'circle' }),
    onSuccess: () => { setIssueType({ name: '', color: '#64748b', icon: 'circle' }); setSuccess('Issue type created successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not create issue type.'),
  });

  const createCustomField = useMutation({
    mutationFn: () => projectsApi.createCustomField(id, {
      name: customField.name.trim(),
      key: customField.key.trim(),
      type: customField.type,
      options: customField.options ? customField.options.split(',').map((x) => x.trim()).filter(Boolean) : [],
      isRequired: customField.isRequired,
    }),
    onSuccess: () => { setCustomField({ name: '', key: '', type: 'TEXT', options: '', isRequired: false }); setSuccess('Custom field created successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not create custom field.'),
  });

  const createWorkflow = useMutation({
    mutationFn: () => projectsApi.createWorkflow(id, { name: workflow.name.trim() }),
    onSuccess: (created: any) => { setWorkflow({ name: '' }); setStatus((s) => ({ ...s, workflowId: created?.id ?? s.workflowId })); setSuccess('Workflow created successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not create workflow.'),
  });

  const createStatus = useMutation({
    mutationFn: () => projectsApi.createStatus(id, status.workflowId, { name: status.name.trim(), category: status.category, color: status.color, wipLimit: status.wipLimit ? Number(status.wipLimit) : null }),
    onSuccess: () => { setStatus((s) => ({ ...s, name: '', wipLimit: '' })); setSuccess('Workflow status added successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not add workflow status.'),
  });

  const createTransition = useMutation({
    mutationFn: () => projectsApi.createTransition(id, transition.workflowId, { fromStatusId: transition.fromStatusId, toStatusId: transition.toStatusId, name: transition.name.trim() }),
    onSuccess: () => { setTransition((s) => ({ ...s, fromStatusId: '', toStatusId: '', name: '' })); setSuccess('Workflow transition added successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not add workflow transition.'),
  });

  const createGuard = useMutation({
    mutationFn: () => projectsApi.createGuard(id, guard.workflowId, guard.transitionId, { type: guard.type, fieldId: guard.fieldId || null, config: guard.type === 'PERMISSION' ? { minRole: guard.minRole } : {} }),
    onSuccess: () => { setGuard((s) => ({ ...s, transitionId: '', fieldId: '' })); setSuccess('Transition guard added successfully.'); invalidate(); },
    onError: (err) => setFailure(err, 'Could not add transition guard.'),
  });

  const submit = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); setNotice(null); setErrors({}); fn(); };

  function saveGeneral() {
    const name = normalizeTrim(general.name || project.data?.name || '');
    if (!name) return block({ generalName: 'Project name is required.' });
    updateProject.mutate({ name, description: general.description || project.data?.description || '' });
  }

  function saveInvite() {
    const email = invite.email.trim();
    if (!email) return block({ inviteEmail: 'Email address is required.' });
    if (!isValidEmail(email)) return block({ inviteEmail: 'Enter a valid email address.' });
    if (!roles.includes(invite.role)) return block({ inviteRole: 'Role is required.' });
    inviteMember.mutate();
  }

  function saveIssueType() {
    if (!issueType.name.trim()) return block({ issueTypeName: 'Issue type name is required.' });
    createIssueType.mutate();
  }

  function saveCustomField() {
    const formErrors: FormErrors = {};
    if (!customField.name.trim()) formErrors.customFieldName = 'Field name is required.';
    if (!customField.key.trim()) formErrors.customFieldKey = 'Field key is required.';
    else if (!isValidFieldKey(customField.key)) formErrors.customFieldKey = 'Use lowercase letters, numbers, and underscores. Start with a letter.';
    if (optionFieldTypes.has(customField.type) && !customField.options.split(',').map((x) => x.trim()).filter(Boolean).length) formErrors.customFieldOptions = 'Options are required for dropdown and multiselect fields.';
    if (Object.keys(formErrors).length) return block(formErrors);
    createCustomField.mutate();
  }

  function saveWorkflow() {
    if (!workflow.name.trim()) return block({ workflowName: 'Workflow name is required.' });
    createWorkflow.mutate();
  }

  function saveStatus() {
    const formErrors: FormErrors = {};
    if (!status.workflowId) formErrors.statusWorkflow = 'Select a workflow first.';
    if (!status.name.trim()) formErrors.statusName = 'Status name is required.';
    if (!positiveNumberOrBlank(status.wipLimit)) formErrors.statusWip = 'WIP limit must be a positive number or blank.';
    if (Object.keys(formErrors).length) return block(formErrors);
    createStatus.mutate();
  }

  function saveTransition() {
    const formErrors: FormErrors = {};
    if (!transition.workflowId) formErrors.transitionWorkflow = 'Select a workflow first.';
    if (!transition.fromStatusId) formErrors.transitionFrom = 'Select a From status.';
    if (!transition.toStatusId) formErrors.transitionTo = 'Select a To status.';
    if (transition.fromStatusId && transition.toStatusId && transition.fromStatusId === transition.toStatusId) formErrors.transitionTo = 'From and To statuses cannot be the same.';
    if (!transition.name.trim()) formErrors.transitionName = 'Transition name is required.';
    if (Object.keys(formErrors).length) return block(formErrors);
    createTransition.mutate();
  }

  function saveGuard() {
    const formErrors: FormErrors = {};
    if (!guard.transitionId) formErrors.guardTransition = 'Select a transition first.';
    if (!guard.type) formErrors.guardType = 'Guard type is required.';
    if (guard.type === 'REQUIRED_FIELD' && !guard.fieldId) formErrors.guardField = 'Select the required custom field.';
    if (guard.type === 'PERMISSION' && !guard.minRole) formErrors.guardRole = 'Select the minimum required role.';
    if (Object.keys(formErrors).length) return block(formErrors);
    createGuard.mutate();
  }

  function onCustomFieldNameChange(name: string) {
    setCustomField((current) => {
      const previousAuto = fieldKeyFromName(current.name);
      const shouldAutofill = !current.key || current.key === previousAuto;
      return { ...current, name, key: shouldAutofill ? fieldKeyFromName(name) : current.key };
    });
  }

  if (project.isLoading) return <div>Loading project settings…</div>;
  if (project.error) return <Feedback tone="error" title="Failed to load project settings" message={getApiErrorMessage(project.error)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{project.data?.name ?? 'Project'} settings</h1>
          <p className="text-sm text-muted-foreground">Configure members, fields, issue types, workflows, guards, WIP limits, webhooks, and integration settings.</p>
        </div>
        <Button variant="outline" asChild><Link to={`/projects/${id}/issues`}>Open issues</Link></Button>
      </div>

      <Feedback tone={notice?.tone} title={notice?.title} message={notice?.message} />

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="types">Issue types</TabsTrigger>
          <TabsTrigger value="fields">Custom fields</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card><CardHeader><CardTitle>General</CardTitle></CardHeader><CardContent>
            <form className="space-y-3" onSubmit={submit(saveGeneral)}>
              <div><Input placeholder={project.data?.name ?? 'Project name'} value={general.name} onChange={(e) => setGeneral((s) => ({ ...s, name: e.target.value }))} /><FieldError message={errors.generalName} /></div>
              <Textarea placeholder={project.data?.description ?? 'Description'} value={general.description} onChange={(e) => setGeneral((s) => ({ ...s, description: e.target.value }))} />
              <LoadingButton type="submit" loading={updateProject.isPending} loadingText="Saving…">Save general settings</LoadingButton>
            </form>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="members">
          <Card><CardHeader><CardTitle>Members and roles</CardTitle></CardHeader><CardContent className="space-y-4">
            <form onSubmit={submit(saveInvite)}>
              <FormRow>
                <div><Input placeholder="email@example.gov.pk" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} /><FieldError message={errors.inviteEmail} /></div>
                <div><SelectBox value={invite.role} onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value }))}>{roles.map((r) => <option key={r}>{r}</option>)}</SelectBox><FieldError message={errors.inviteRole} /></div>
                <LoadingButton type="submit" loading={inviteMember.isPending} loadingText="Adding…">Invite / add member</LoadingButton>
              </FormRow>
            </form>
            <div className="rounded-lg border">
              <table className="w-full text-sm"><tbody>{(members.data ?? []).map((m: any) => {
                const userId = m.user?.id ?? m.userId;
                return <tr key={userId} className="border-b"><td className="p-3">{m.user?.name}<br /><span className="text-xs text-muted-foreground">{m.user?.email}</span></td><td className="p-3"><SelectBox className="h-9" value={m.role} onChange={(e) => updateMember.mutate({ userId, role: e.target.value })}>{roles.map((r) => <option key={r}>{r}</option>)}</SelectBox></td><td className="p-3 text-right"><ConfirmDialog title="Remove project member?" description={`Remove ${m.user?.email ?? 'this user'} from this project?`} confirmText="Remove" onConfirm={() => removeMember.mutate(userId)}><Button size="sm" variant="destructive">Remove</Button></ConfirmDialog></td></tr>;
              })}</tbody></table>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="types">
          <Card><CardHeader><CardTitle>Issue types</CardTitle></CardHeader><CardContent className="space-y-4">
            <form onSubmit={submit(saveIssueType)}><FormRow><div><Input placeholder="Epic / Change / Defect" value={issueType.name} onChange={(e) => setIssueType((s) => ({ ...s, name: e.target.value }))} /><FieldError message={errors.issueTypeName} /></div><Input placeholder="#64748b" value={issueType.color} onChange={(e) => setIssueType((s) => ({ ...s, color: e.target.value }))} /><Input placeholder="icon" value={issueType.icon} onChange={(e) => setIssueType((s) => ({ ...s, icon: e.target.value }))} /><LoadingButton type="submit" loading={createIssueType.isPending} loadingText="Creating…">Create issue type</LoadingButton></FormRow></form>
            <div className="grid gap-3 md:grid-cols-2">{(types.data ?? []).map((t: any) => <Card key={t.id}><CardContent className="pt-6"><div className="flex items-center justify-between"><div><div className="font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t._count?.issues ?? 0} issues · {t.fields?.length ?? 0} fields</div></div><Badge style={{ borderColor: t.color }}>{t.icon}</Badge></div></CardContent></Card>)}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card><CardHeader><CardTitle>Custom fields</CardTitle></CardHeader><CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={submit(saveCustomField)}>
              <FormRow><div><Input placeholder="Field name" value={customField.name} onChange={(e) => onCustomFieldNameChange(e.target.value)} /><FieldError message={errors.customFieldName} /></div><div><Input placeholder="field_key" value={customField.key} onChange={(e) => setCustomField((s) => ({ ...s, key: e.target.value }))} /><FieldError message={errors.customFieldKey} /></div><SelectBox value={customField.type} onChange={(e) => setCustomField((s) => ({ ...s, type: e.target.value }))}>{fieldTypes.map((t) => <option key={t}>{t}</option>)}</SelectBox><LoadingButton type="submit" loading={createCustomField.isPending} loadingText="Creating…">Create custom field</LoadingButton></FormRow>
              <div><Input placeholder="Options for dropdown/multiselect, comma separated" value={customField.options} onChange={(e) => setCustomField((s) => ({ ...s, options: e.target.value }))} /><FieldError message={errors.customFieldOptions} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={customField.isRequired} onChange={(e) => setCustomField((s) => ({ ...s, isRequired: e.target.checked }))} /> Required</label>
            </form>
            <div className="grid gap-3 md:grid-cols-2">{(fields.data ?? []).map((f: any) => <Card key={f.id}><CardContent className="pt-6"><div className="flex items-center justify-between"><div><div className="font-semibold">{f.name}</div><div className="text-xs text-muted-foreground">{f.key} · {f.type} · {f.isRequired ? 'required' : 'optional'}</div></div><Badge>{f._count?.values ?? 0} values</Badge></div></CardContent></Card>)}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="workflows">
          <Card><CardHeader><CardTitle>Workflow builder and guards</CardTitle></CardHeader><CardContent className="space-y-6">
            <form onSubmit={submit(saveWorkflow)}><FormRow><div><Input placeholder="Workflow name" value={workflow.name} onChange={(e) => setWorkflow({ name: e.target.value })} /><FieldError message={errors.workflowName} /></div><LoadingButton type="submit" loading={createWorkflow.isPending} loadingText="Creating…">Create workflow</LoadingButton></FormRow></form>
            <form onSubmit={submit(saveStatus)}><FormRow><div><SelectBox value={status.workflowId} onChange={(e) => setStatus((s) => ({ ...s, workflowId: e.target.value }))}><option value="">Select workflow</option>{(workflows.data ?? []).map((wf: any) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}</SelectBox><FieldError message={errors.statusWorkflow} /></div><div><Input placeholder="Status name" value={status.name} onChange={(e) => setStatus((s) => ({ ...s, name: e.target.value }))} /><FieldError message={errors.statusName} /></div><SelectBox value={status.category} onChange={(e) => setStatus((s) => ({ ...s, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</SelectBox><div><Input placeholder="WIP limit" value={status.wipLimit} onChange={(e) => setStatus((s) => ({ ...s, wipLimit: e.target.value }))} /><FieldError message={errors.statusWip} /></div><LoadingButton type="submit" loading={createStatus.isPending} loadingText="Adding…">Add status</LoadingButton></FormRow></form>
            <form onSubmit={submit(saveTransition)}><FormRow><div><SelectBox value={transition.workflowId} onChange={(e) => setTransition((s) => ({ ...s, workflowId: e.target.value, fromStatusId: '', toStatusId: '' }))}><option value="">Workflow</option>{(workflows.data ?? []).map((wf: any) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}</SelectBox><FieldError message={errors.transitionWorkflow} /></div><div><SelectBox value={transition.fromStatusId} onChange={(e) => setTransition((s) => ({ ...s, fromStatusId: e.target.value }))}><option value="">From</option>{(workflows.data ?? []).find((wf: any) => wf.id === transition.workflowId)?.statuses?.map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}</SelectBox><FieldError message={errors.transitionFrom} /></div><div><SelectBox value={transition.toStatusId} onChange={(e) => setTransition((s) => ({ ...s, toStatusId: e.target.value }))}><option value="">To</option>{(workflows.data ?? []).find((wf: any) => wf.id === transition.workflowId)?.statuses?.map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}</SelectBox><FieldError message={errors.transitionTo} /></div><div><Input placeholder="Transition name" value={transition.name} onChange={(e) => setTransition((s) => ({ ...s, name: e.target.value }))} /><FieldError message={errors.transitionName} /></div><LoadingButton type="submit" loading={createTransition.isPending} loadingText="Adding…">Add transition</LoadingButton></FormRow></form>
            <form onSubmit={submit(saveGuard)}><FormRow><div><SelectBox value={guard.transitionId} onChange={(e) => { const tr = allTransitions.find((x: any) => x.id === e.target.value); setGuard((s) => ({ ...s, transitionId: e.target.value, workflowId: tr?.workflowId ?? '' })); }}><option value="">Transition</option>{allTransitions.map((tr: any) => <option key={tr.id} value={tr.id}>{tr.workflowName}: {tr.fromStatus?.name} → {tr.toStatus?.name}</option>)}</SelectBox><FieldError message={errors.guardTransition} /></div><div><SelectBox value={guard.type} onChange={(e) => setGuard((s) => ({ ...s, type: e.target.value }))}>{guardTypes.map((g) => <option key={g}>{g}</option>)}</SelectBox><FieldError message={errors.guardType} /></div><div><SelectBox value={guard.fieldId} onChange={(e) => setGuard((s) => ({ ...s, fieldId: e.target.value }))}><option value="">Custom field</option>{(fields.data ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</SelectBox><FieldError message={errors.guardField} /></div><div><SelectBox value={guard.minRole} onChange={(e) => setGuard((s) => ({ ...s, minRole: e.target.value }))}>{roles.map((r) => <option key={r}>{r}</option>)}</SelectBox><FieldError message={errors.guardRole} /></div><LoadingButton type="submit" loading={createGuard.isPending} loadingText="Adding…">Add guard</LoadingButton></FormRow></form>
            <div className="grid gap-4">{(workflows.data ?? []).map((wf: any) => <Card key={wf.id}><CardContent className="space-y-3 pt-6"><div className="font-semibold">{wf.name} {wf.isDefault && <Badge>Default</Badge>}</div><div className="flex flex-wrap gap-2">{wf.statuses?.map((st: any) => <Badge key={st.id}>{st.name} · {st.category}{st.wipLimit ? ` · WIP ${st.wipLimit}` : ''}</Badge>)}</div><div className="space-y-2 text-sm">{wf.transitions?.map((tr: any) => <div key={tr.id} className="rounded-md border p-2"><b>{tr.name}</b>: {tr.fromStatus?.name} → {tr.toStatus?.name}<div className="mt-1 text-xs text-muted-foreground">Guards: {(tr.guards ?? []).map((g: any) => `${g.type}${g.field?.name ? `(${g.field.name})` : ''}`).join(', ') || 'none'}</div></div>)}</div></CardContent></Card>)}</div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
