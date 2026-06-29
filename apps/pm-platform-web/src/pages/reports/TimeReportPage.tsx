import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '@/api/performance.api';
import { Button } from '@/components/ui/button';
import { WorklogList } from '@/components/time/WorklogList';
export function TimeReportPage() { const { data = [] } = useQuery({ queryKey: ['time-report'], queryFn: () => performanceApi.timeReport() }); async function download() { const res = await performanceApi.exportTime(); const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = 'time-report.csv'; a.click(); URL.revokeObjectURL(url); } return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Time report</h1><Button onClick={download}>Export CSV</Button></div><WorklogList worklogs={data} /></div>; }
