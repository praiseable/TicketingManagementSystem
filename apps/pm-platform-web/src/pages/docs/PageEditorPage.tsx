import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { pagesApi } from '@/api/pages.api';
import { spacesApi } from '@/api/spaces.api';
import { CollabCursors } from '@/components/docs/CollabCursors';
import { PageBreadcrumb } from '@/components/docs/PageBreadcrumb';
import { SpaceTree } from '@/components/docs/SpaceTree';
import { TiptapEditor } from '@/components/docs/TiptapEditor';
import { Input } from '@/components/ui/input';
export function PageEditorPage() { const { spaceId = '', pageId = '' } = useParams(); const qc = useQueryClient(); const space = useQuery({ queryKey: ['space', spaceId], queryFn: () => spacesApi.get(spaceId), enabled: Boolean(spaceId) }); const pages = useQuery({ queryKey: ['pages', spaceId], queryFn: () => pagesApi.tree(spaceId), enabled: Boolean(spaceId) }); const page = useQuery({ queryKey: ['page', pageId], queryFn: () => pagesApi.get(spaceId, pageId), enabled: Boolean(spaceId && pageId) }); const update = useMutation({ mutationFn: (body: any) => pagesApi.update(spaceId, pageId, body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['page', pageId] }); qc.invalidateQueries({ queryKey: ['pages', spaceId] }); } }); const save = useCallback((html: string, json: unknown) => update.mutate({ content: html, contentJson: json }), [update]); return <div className="grid gap-4 md:grid-cols-[280px_1fr]"><SpaceTree pages={pages.data} /><main className="space-y-4"><PageBreadcrumb space={space.data} page={page.data} /><Input className="h-auto border-0 px-0 text-3xl font-bold shadow-none focus-visible:ring-0" value={page.data?.title ?? ''} onChange={(e) => update.mutate({ title: e.target.value })} /><CollabCursors /><TiptapEditor pageId={pageId} content={page.data?.content ?? ''} onSave={save} /></main></div>; }
