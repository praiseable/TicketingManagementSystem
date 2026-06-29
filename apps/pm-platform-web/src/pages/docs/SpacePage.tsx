import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { pagesApi } from '@/api/pages.api';
import { spacesApi } from '@/api/spaces.api';
import { Button } from '@/components/ui/button';
import { PageBreadcrumb } from '@/components/docs/PageBreadcrumb';
import { SpaceTree } from '@/components/docs/SpaceTree';
export function SpacePage() { const { spaceId = '' } = useParams(); const qc = useQueryClient(); const space = useQuery({ queryKey: ['space', spaceId], queryFn: () => spacesApi.get(spaceId), enabled: Boolean(spaceId) }); const pages = useQuery({ queryKey: ['pages', spaceId], queryFn: () => pagesApi.tree(spaceId), enabled: Boolean(spaceId) }); const create = useMutation({ mutationFn: () => pagesApi.create(spaceId, { title: 'Untitled page', content: '<p>Start writing…</p>' } as any), onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', spaceId] }) }); const first = pages.data?.[0]; return <div className="grid gap-4 md:grid-cols-[280px_1fr]"><SpaceTree pages={pages.data} /><main className="rounded-lg border p-6"><PageBreadcrumb space={space.data} /><h1 className="text-3xl font-bold">{space.data?.name}</h1><p className="mt-2 text-muted-foreground">{space.data?.description ?? 'Team knowledge base'}</p><div className="mt-6 flex gap-2"><Button onClick={() => create.mutate()}>New page</Button>{first && <Button asChild variant="outline"><Link to={`/spaces/${spaceId}/pages/${first.id}`}>Open first page</Link></Button>}</div></main></div>; }
