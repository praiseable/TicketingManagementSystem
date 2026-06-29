import { useParams } from 'react-router-dom';
import { IssueDetail } from '@/components/issues/IssueDetail';
export function IssueDetailPage() { const { id = '', issueId = '' } = useParams(); return <IssueDetail projectId={id} issueId={issueId} />; }
