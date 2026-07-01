import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { spacesApi } from '@/api/spaces.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function SpaceListPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<'TEAM' | 'PROJECT' | 'PERSONAL'>('TEAM');

  const { data = [], isLoading } = useQuery({ queryKey: ['spaces'], queryFn: spacesApi.list });

  const suggestedKey = useMemo(() => name.split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 8), [name]);

  const create = useMutation({
    mutationFn: () => spacesApi.create({ type, name, key: key || suggestedKey || `SP${Date.now()}`, description: 'Knowledge base space' } as any),
    onSuccess: () => {
      setName('');
      setKey('');
      qc.invalidateQueries({ queryKey: ['spaces'] });
    }
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  }

  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold">Documentation spaces</h1>
      <p className="text-sm text-muted-foreground">Create project, team, and personal knowledge spaces.</p>
    </div>

    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_160px_160px_auto]">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Space name" />
      <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder={suggestedKey || 'KEY'} />
      <select className="rounded-md border bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
        <option value="TEAM">Team</option>
        <option value="PROJECT">Project</option>
        <option value="PERSONAL">Personal</option>
      </select>
      <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create space'}</Button>
    </form>

    {isLoading ? <p>Loading spaces…</p> : <div className="grid gap-4 md:grid-cols-3">
      {data.map((space) => <Link key={space.id} to={`/spaces/${space.id}`}>
        <Card className="h-full transition hover:-translate-y-0.5 hover:bg-accent hover:shadow-md">
          <CardHeader><CardTitle>{space.name}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{space.description ?? 'Documentation space'}</p>
            <p>{space.type} · {space.key} · {space._count?.pages ?? 0} pages</p>
          </CardContent>
        </Card>
      </Link>)}
    </div>}
  </div>;
}
