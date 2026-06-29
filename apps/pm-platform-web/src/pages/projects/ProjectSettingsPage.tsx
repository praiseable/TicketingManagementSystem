import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MailPlus, Shield, Trash2, Users } from 'lucide-react';
import { projectsApi } from '@/api/projects.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectMember, ProjectRole } from '@/types';

const roles: ProjectRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const roleHelp: Record<ProjectRole, string> = {
  OWNER: 'Full project ownership and settings control',
  ADMIN: 'Can configure members, workflow, fields, and sprints',
  MEMBER: 'Can work on issues and boards',
  VIEWER: 'Read-only project access'
};

function roleBadge(role: ProjectRole) {
  const cls = role === 'OWNER' ? 'border-amber-300 bg-amber-50 text-amber-700' : role === 'ADMIN' ? 'border-blue-300 bg-blue-50 text-blue-700' : role === 'MEMBER' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-50 text-slate-700';
  return <Badge className={cls}>{role}</Badge>;
}

export function ProjectSettingsPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('MEMBER');

  const project = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id), enabled: Boolean(id) });
  const members = useQuery({ queryKey: ['project-members', id], queryFn: () => projectsApi.members(id), enabled: Boolean(id) });
  const types = useQuery({ queryKey: ['issue-types', id], queryFn: () => projectsApi.issueTypes(id), enabled: Boolean(id) });
  const fields = useQuery({ queryKey: ['custom-fields', id], queryFn: () => projectsApi.customFields(id), enabled: Boolean(id) });

  useEffect(() => {
    if (project.data) {
      setName(project.data.name ?? '');
      setDescription(project.data.description ?? '');
    }
  }, [project.data?.id]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['project', id] }),
      qc.invalidateQueries({ queryKey: ['projects'] }),
      qc.invalidateQueries({ queryKey: ['project-members', id] })
    ]);
  };

  const updateProject = useMutation({
    mutationFn: () => projectsApi.update(id, { name: name.trim(), description: description.trim() || null }),
    onSuccess: async () => { setMessage('Project updated'); setError(null); await refresh(); },
    onError: (err: any) => { setMessage(null); setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not update project'); }
  });

  const invite = useMutation({
    mutationFn: () => projectsApi.invite(id, { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: async (data) => {
      setMessage(data.existingUserAdded ? 'Existing user was added to the project' : 'Invitation created');
      setError(null);
      setInviteEmail('');
      setInviteRole('MEMBER');
      await refresh();
    },
    onError: (err: any) => { setMessage(null); setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not invite member'); }
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) => projectsApi.updateMember(id, userId, role),
    onSuccess: async () => { setMessage('Member role updated'); setError(null); await refresh(); },
    onError: (err: any) => { setMessage(null); setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not update member role'); }
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: async () => { setMessage('Member removed'); setError(null); await refresh(); },
    onError: (err: any) => { setMessage(null); setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not remove member'); }
  });

  const defaultWorkflow = useMemo(() => project.data?.workflows?.find((wf) => wf.isDefault) ?? project.data?.workflows?.[0], [project.data?.workflows]);

  function saveGeneral(event: FormEvent) {
    event.preventDefault();
    updateProject.mutate();
  }

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!inviteEmail.trim()) return setError('Email is required');
    invite.mutate();
  }

  if (project.isLoading) return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading project settings…</div>;
  if (project.isError || !project.data) return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Could not load project.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm"><Link to="/projects"><ArrowLeft className="h-4 w-4" /> Projects</Link></Button>
          <h1 className="text-3xl font-bold tracking-tight">{project.data.name} settings</h1>
          <p className="text-sm text-muted-foreground">Manage project profile, members, roles, issue types, and workflow foundation.</p>
        </div>
        <div className="flex gap-2"><Button asChild><Link to={`/projects/${id}/board`}>Open board</Link></Button></div>
      </div>

      {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {message}</div>}
      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="types">Issue types</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="fields">Custom fields</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveGeneral}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Project name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Project key</Label><Input value={project.data.key} disabled /></div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="grid gap-4 text-sm md:grid-cols-3">
                  <div className="rounded-lg border p-3"><div className="font-semibold">{project.data._count?.issues ?? 0}</div><div className="text-muted-foreground">Issues</div></div>
                  <div className="rounded-lg border p-3"><div className="font-semibold">{project.data._count?.members ?? 0}</div><div className="text-muted-foreground">Members</div></div>
                  <div className="rounded-lg border p-3"><div className="font-semibold">{project.data.lead?.email ?? '—'}</div><div className="text-muted-foreground">Lead</div></div>
                </div>
                <Button type="submit" disabled={updateProject.isPending}>{updateProject.isPending ? 'Saving…' : 'Save changes'}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5" /> Invite team member</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" onSubmit={submitInvite}>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="dev1@acme.com" />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ProjectRole)}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
                <Button type="submit" disabled={invite.isPending}>{invite.isPending ? 'Inviting…' : 'Invite / Add'}</Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">If the email belongs to an existing organization user, they are added immediately. Otherwise, an invitation token is created for onboarding.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Project members</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(members.data ?? []).map((member: ProjectMember) => (
                <div key={member.userId} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_180px_auto] md:items-center">
                  <div>
                    <div className="font-medium">{member.user?.name ?? member.user?.email ?? member.userId}</div>
                    <div className="text-xs text-muted-foreground">{member.user?.email}</div>
                    <div className="mt-1">{roleBadge(member.role)}</div>
                  </div>
                  <div>
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={member.role} onChange={(e) => updateRole.mutate({ userId: member.userId, role: e.target.value as ProjectRole })}>
                      {roles.map((role) => <option key={role} value={role}>{role} — {roleHelp[role]}</option>)}
                    </select>
                  </div>
                  <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={member.role === 'OWNER' && (members.data ?? []).filter((m) => m.role === 'OWNER').length <= 1} onClick={() => removeMember.mutate(member.userId)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Issue types</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {(types.data as any[] | undefined ?? project.data.issueTypes ?? []).map((type: any) => (
                <div key={type.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between"><div className="font-semibold">{type.name}</div>{type.isDefault && <Badge>Default</Badge>}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Icon: {type.icon} · Position: {type.position}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Default workflow</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(defaultWorkflow?.statuses ?? []).map((status, index) => (
                  <div key={status.id} className="flex items-center gap-2">
                    <Badge style={{ borderColor: status.color, color: status.color }}>{status.name}</Badge>
                    {index < (defaultWorkflow?.statuses?.length ?? 0) - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Transitions</div>
                {(defaultWorkflow?.transitions ?? []).map((t: any) => <div key={t.id} className="rounded-md border px-3 py-2 text-sm">{t.fromStatus?.name ?? t.fromStatusId} → {t.toStatus?.name ?? t.toStatusId}</div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Custom fields</CardTitle></CardHeader>
            <CardContent>
              {(fields.data ?? []).length === 0 ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No custom fields configured yet. Full custom field builder is planned in UC-17.</div> : <pre className="text-xs">{JSON.stringify(fields.data, null, 2)}</pre>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
