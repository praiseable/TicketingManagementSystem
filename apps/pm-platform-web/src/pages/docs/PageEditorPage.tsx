import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { pagesApi } from '@/api/pages.api';
import { spacesApi } from '@/api/spaces.api';
import { CollabCursors } from '@/components/docs/CollabCursors';
import { PageBreadcrumb } from '@/components/docs/PageBreadcrumb';
import { SpaceTree } from '@/components/docs/SpaceTree';
import { TiptapEditor } from '@/components/docs/TiptapEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PageEditorPage() {
  const { spaceId = '', pageId = '' } = useParams();
  const qc = useQueryClient();
  const [titleDraft, setTitleDraft] = useState('');

  const space = useQuery({ queryKey: ['space', spaceId], queryFn: () => spacesApi.get(spaceId), enabled: Boolean(spaceId) });
  const pages = useQuery({ queryKey: ['pages', spaceId], queryFn: () => pagesApi.tree(spaceId), enabled: Boolean(spaceId) });
  const page = useQuery({ queryKey: ['page', pageId], queryFn: () => pagesApi.get(spaceId, pageId), enabled: Boolean(spaceId && pageId) });
  const versions = useQuery({ queryKey: ['pageVersions', pageId], queryFn: () => pagesApi.versions(spaceId, pageId), enabled: Boolean(spaceId && pageId) });
  const collab = useQuery({ queryKey: ['pageCollab', pageId], queryFn: () => pagesApi.collabState(spaceId, pageId), enabled: Boolean(spaceId && pageId), refetchInterval: 30000 });

  useEffect(() => { if (page.data?.title) setTitleDraft(page.data.title); }, [page.data?.title]);
  useEffect(() => { if (spaceId && pageId) pagesApi.collabPresence(spaceId, pageId).catch(() => undefined); }, [spaceId, pageId]);

  const update = useMutation({
    mutationFn: (body: any) => pagesApi.update(spaceId, pageId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['page', pageId] });
      qc.invalidateQueries({ queryKey: ['pages', spaceId] });
      qc.invalidateQueries({ queryKey: ['pageVersions', pageId] });
      qc.invalidateQueries({ queryKey: ['pageCollab', pageId] });
    }
  });

  const restore = useMutation({
    mutationFn: (version: number) => pagesApi.restore(spaceId, pageId, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['page', pageId] });
      qc.invalidateQueries({ queryKey: ['pageVersions', pageId] });
    }
  });

  const save = useCallback((html: string, json: unknown) => update.mutate({ content: html, contentJson: json }), [update]);

  return <div className="grid gap-4 md:grid-cols-[280px_1fr]">
    <SpaceTree pages={pages.data} />
    <main className="space-y-4">
      <PageBreadcrumb space={space.data} page={page.data} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input className="h-auto max-w-3xl border-0 px-0 text-3xl font-bold shadow-none focus-visible:ring-0" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => titleDraft && titleDraft !== page.data?.title && update.mutate({ title: titleDraft })} />
        <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">Version {page.data?.version ?? '-'} · Autosave</div>
      </div>
      <CollabCursors />
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">Collaborative editing baseline active · {(collab.data as any)?.presence?.length ?? 0} active presence record(s)</div>
      <TiptapEditor key={page.data?.id + ':' + page.data?.version} pageId={pageId} content={page.data?.content ?? ''} onSave={save} />

      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Page versions</h2>
        <p className="text-sm text-muted-foreground">Every save creates a version that can be restored.</p>
        <div className="mt-3 space-y-2">
          {(versions.data ?? []).map((v) => <div key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>Version {v.version} · {new Date(v.createdAt).toLocaleString()}</span>
            <Button size="sm" variant="outline" disabled={restore.isPending || v.version === page.data?.version} onClick={() => restore.mutate(v.version)}>Restore</Button>
          </div>)}
        </div>
      </section>
    </main>
  </div>;
}
