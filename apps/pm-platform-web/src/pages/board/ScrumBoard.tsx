import { useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { IssueCard } from '@/components/issues/IssueCard';
import { useSprints } from '@/hooks/useSprints';
export function ScrumBoard() { const { id = '' } = useParams(); const { data } = useSprints(id); const active = data?.find((s) => s.status === 'ACTIVE'); if (!active) return <EmptyState title="No active sprint" description="Start a sprint to use Scrum board." />; return <div className="space-y-4"><h1 className="text-2xl font-bold">{active.name}</h1><div className="grid gap-3 md:grid-cols-3">{active.issues?.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</div></div>; }
