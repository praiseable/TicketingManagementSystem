import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { sprintsApi } from '@/api/sprints.api';
import { BurndownChart } from '@/components/sprints/BurndownChart';
import { SprintHeader } from '@/components/sprints/SprintHeader';
import { VelocityChart } from '@/components/sprints/VelocityChart';
import { useSprints } from '@/hooks/useSprints';
export function SprintsPage() { const { id = '' } = useParams(); const { data = [] } = useSprints(id); const active = data.find((s) => s.status === 'ACTIVE') ?? data[0]; const burndown = useQuery({ queryKey: ['burndown', active?.id], queryFn: () => sprintsApi.burndown(id, active!.id), enabled: Boolean(active) }); const velocity = useQuery({ queryKey: ['velocity', id], queryFn: () => sprintsApi.velocity(id), enabled: Boolean(id) }); return <div className="space-y-4"><h1 className="text-3xl font-bold">Sprints</h1>{active && <SprintHeader sprint={active} />}<div className="grid gap-4 lg:grid-cols-2"><BurndownChart data={burndown.data} /><VelocityChart data={velocity.data?.map((x) => ({ name: x.name, committed: x.committed, completed: x.completed }))} /></div></div>; }
