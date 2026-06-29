import { Link, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { Page } from '@/types';

function Node({ page, pages, depth = 0 }: { page: Page; pages: Page[]; depth?: number }) { const children = pages.filter((p) => p.parentId === page.id); return <div><Link to={`/spaces/${page.spaceId}/pages/${page.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent" style={{ paddingLeft: 8 + depth * 16 }}><FileText className="h-4 w-4" />{page.title}</Link>{children.map((child) => <Node key={child.id} page={child} pages={pages} depth={depth + 1} />)}</div>; }
export function SpaceTree({ pages = [] }: { pages?: Page[] }) { const { spaceId } = useParams(); const roots = pages.filter((p) => !p.parentId); return <aside className="rounded-lg border bg-card p-2"><Link to={`/spaces/${spaceId}`} className="mb-2 block rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-accent">Space home</Link>{roots.map((page) => <Node key={page.id} page={page} pages={pages} />)}{!pages.length && <p className="p-3 text-sm text-muted-foreground">No pages yet.</p>}</aside>; }
