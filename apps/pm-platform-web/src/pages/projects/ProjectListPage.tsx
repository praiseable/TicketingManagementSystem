import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FolderKanban, Plus, Settings, Users } from 'lucide-react';
import { projectsApi, type CreateProjectInput } from '@/api/projects.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function makeKey(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 8) || 'PRJ';
}

export function ProjectListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projects = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  const create = useMutation({
    mutationFn: (body: CreateProjectInput) => projectsApi.create(body),
    onSuccess: async (project) => {
      await qc.invalidateQueries({ queryKey: ['projects'] });
      setOpen(false);
      setName('');
      setKey('');
      setDescription('');
      setError(null);
      navigate(`/projects/${project.id}/settings`);
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not create project')
  });

  const keyPreview = useMemo(() => key || makeKey(name), [key, name]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedKey = keyPreview.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!name.trim()) return setError('Project name is required');
    if (normalizedKey.length < 2) return setError('Project key must be at least 2 characters');
    create.mutate({ name: name.trim(), key: normalizedKey, description: description.trim() || null });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Create projects with default issue types, workflow columns, and owner membership.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Create project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={submit}>
              {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input id="project-name" value={name} onChange={(e) => { setName(e.target.value); if (!key) setKey(makeKey(e.target.value)); }} placeholder="Human Resource Portal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-key">Key</Label>
                <Input id="project-key" value={keyPreview} onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="HRP" />
                <p className="text-xs text-muted-foreground">Used for issue keys, for example {keyPreview || 'HRP'}-1.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will this project track?" />
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                New projects automatically receive Bug, Story, Task issue types and the default Backlog → Todo → In Progress → In Review → Done workflow.
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create project'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {projects.isLoading && <div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading projects…</div>}
      {projects.isError && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">Could not load projects.</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(projects.data ?? []).map((project) => (
          <Card key={project.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FolderKanban className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{project.key}</div>
                  </div>
                </div>
                <Badge>{project.currentUserRole ?? 'MEMBER'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{project.description ?? 'No description provided.'}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-lg border p-2"><div className="font-semibold text-foreground">{project._count?.issues ?? 0}</div>Issues</div>
                <div className="rounded-lg border p-2"><div className="font-semibold text-foreground">{project._count?.members ?? 0}</div>Members</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm"><Link to={`/projects/${project.id}/board`}>Board <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
                <Button asChild size="sm" variant="outline"><Link to={`/projects/${project.id}/settings`}><Settings className="h-3.5 w-3.5" /> Settings</Link></Button>
                <Button asChild size="sm" variant="ghost"><Link to={`/projects/${project.id}/settings`}><Users className="h-3.5 w-3.5" /> Members</Link></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
