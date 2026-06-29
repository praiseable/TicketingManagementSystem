import { TeamTable } from '@/components/performance/TeamTable';
import { useTeamPerformance } from '@/hooks/usePerformance';
export function TeamPerformancePage() { const { data = [] } = useTeamPerformance(); return <div className="space-y-4"><h1 className="text-3xl font-bold">Team performance</h1><TeamTable data={data} /></div>; }
