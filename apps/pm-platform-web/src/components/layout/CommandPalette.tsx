import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/useSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { useUiStore } from '@/stores/ui.store';

interface PaletteItem { label: string; path: string; section: string }
export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen); const setOpen = useUiStore((s) => s.setCommandOpen); const [q, setQ] = useState(''); const debounced = useDebounce(q, 200); const { data } = useSearch(debounced); const [index, setIndex] = useState(0); const ref = useRef<HTMLInputElement>(null); const navigate = useNavigate();
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(true); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [setOpen]);
  useEffect(() => { if (open) setTimeout(() => ref.current?.focus(), 20); }, [open]);
  const recent = useMemo<PaletteItem[]>(() => JSON.parse(localStorage.getItem('recent-items') || '[]'), [open]);
  const items = useMemo<PaletteItem[]>(() => [
    ...recent.map((x) => ({ ...x, section: 'Recent' })),
    ...((data?.issues ?? []) as any[]).map((x) => ({ label: `${x.key ?? ''} ${x.title ?? 'Issue'}`, path: `/projects/${x.projectId}/issues/${x.id}`, section: 'Issues' })),
    ...((data?.projects ?? []) as any[]).map((x) => ({ label: `${x.key ?? ''} ${x.name ?? 'Project'}`, path: `/projects/${x.id}/board`, section: 'Projects' })),
    ...((data?.pages ?? []) as any[]).map((x) => ({ label: x.title ?? 'Page', path: `/spaces/${x.spaceId}/pages/${x.id}`, section: 'Pages' })),
    { label: 'Create project', path: '/projects', section: 'Actions' }
  ], [data, recent]);
  function openItem(item: PaletteItem) { const next = [item, ...recent.filter((r) => r.path !== item.path)].slice(0, 10); localStorage.setItem('recent-items', JSON.stringify(next)); setOpen(false); navigate(item.path); }
  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, items.length - 1)); if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0)); if (e.key === 'Enter' && items[index]) openItem(items[index]); }}><motion.div className="w-[min(680px,calc(100vw-2rem))] rounded-xl border bg-background p-3 shadow-2xl" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }} role="dialog" aria-modal="true"><div className="flex items-center gap-2 border-b px-2 pb-2"><Search className="h-4 w-4 text-muted-foreground" /><Input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issues, projects, pages…" className="border-0 shadow-none focus-visible:ring-0" /></div><div className="max-h-96 overflow-y-auto py-2">{items.map((item, i) => <button key={`${item.section}-${item.path}-${i}`} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${i === index ? 'bg-accent' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => openItem(item)}><span>{item.label}</span><span className="text-xs text-muted-foreground">{item.section}</span></button>)}</div></motion.div></motion.div>}</AnimatePresence>;
}
