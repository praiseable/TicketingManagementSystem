import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { pagesApi } from '@/api/pages.api';
import { spacesApi } from '@/api/spaces.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageBreadcrumb } from '@/components/docs/PageBreadcrumb';
import { SpaceTree } from '@/components/docs/SpaceTree';

export function SpacePage() {
  const { spaceId = '' } = useParams();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('blank');

  const space = useQuery({ queryKey: ['space', spaceId], queryFn: () => spacesApi.get(spaceId), enabled: Boolean(spaceId) });
  const pages = useQuery({ queryKey: ['pages', spaceId], queryFn: () => pagesApi.tree(spaceId), enabled: Boolean(spaceId) });

  const create = useMutation({
    mutationFn: () => pagesApi.create(spaceId, { title, template } as any),
    onSuccess: (page) => {
      setTitle('');
      qc.invalidateQueries({ queryKey: ['pages', spaceId] });
      window.location.href = `/spaces/${spaceId}/pages/${page.id}`;
    }
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate();
  }

  const first = pages.data?.[0];

  return <div className="grid gap-4 md:grid-cols-[280px_1fr]">
    <SpaceTree pages={pages.data} />
    <main className="space-y-6 rounded-lg border p-6">
      <PageBreadcrumb space={space.data} />
      <div>
        <h1 className="text-3xl font-bold">{space.data?.name}</h1>
        <p className="mt-2 text-muted-foreground">{space.data?.description ?? 'Team knowledge base'} · {space.data?._count?.pages ?? pages.data?.length ?? 0} pages</p>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_180px_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New page title" />
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="blank">Blank</option>
          <option value="requirements">Requirements</option>
          <option value="meeting">Meeting notes</option>
          <option value="retrospective">Retrospective</option>
          <option value="adr">ADR</option>
        </select>
        <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create page'}</Button>
      </form>

      <div className="flex gap-2">
        {first && <Button asChild variant="outline"><Link to={`/spaces/${spaceId}/pages/${first.id}`}>Open first page</Link></Button>}
        <Button asChild variant="ghost"><Link to="/spaces">Back to spaces</Link></Button>
      </div>
    </main>
  </div>;
}
