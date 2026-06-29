import { useParams } from 'react-router-dom';
import { useIssues } from '@/hooks/useIssues';
import { IssueCard } from '@/components/issues/IssueCard';
export function BacklogPage() { const { id = '' } = useParams(); const { data } = useIssues(id, { sprint: '' }); const issues = data?.data ?? []; return <div className="space-y-4"><h1 className="text-3xl font-bold">Backlog</h1><div className="space-y-2">{issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</div></div>; }
