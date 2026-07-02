import { Link } from 'react-router-dom';
import { MessageSquare, Paperclip, Eye, Clock3, ExternalLink, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/components/common/UserAvatar';
import { PriorityBadge } from './PriorityBadge';
import type { Issue, Label } from '@/types';

function labelOf(item: Label | { label: Label }) {
  return 'label' in item ? item.label : item;
}

function timeLogged(issue: Issue) {
  return (issue.worklogs ?? []).reduce((sum, log) => sum + log.timeSpent, 0);
}

function assigneeName(issue: Issue) {
  return issue.assignee?.name || issue.assignee?.email || 'Unassigned';
}

function humanDuration(seconds = 0) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  if (minutes) return `${minutes}m`;
  return '< 1m';
}

export function IssueCard({ issue, preview = false }: { issue: Issue; preview?: boolean }) {
  const labels = (issue.labels ?? []).map((item: any) => labelOf(item)).filter(Boolean).slice(0, 3);
  const comments = issue._count?.comments ?? issue.comments?.length ?? 0;
  const attachments = issue._count?.attachments ?? issue.attachments?.length ?? 0;
  const watchers = issue._count?.watchers ?? 0;
  const subtasks = issue._count?.children ?? issue.children?.length ?? 0;
  const logged = timeLogged(issue);
  const detailPath = `/projects/${issue.projectId}/issues/${issue.id}`;

  const content = (
    <motion.article
      layout
      className="group relative overflow-hidden rounded-xl border bg-card p-3 pl-10 shadow-sm transition hover:border-primary/40 hover:shadow-lg"
      title="Click task title or description to open full task details"
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: issue.workflowStatus?.color ?? '#64748b' }} />

      <div className="mb-2 flex items-start justify-between gap-2 pt-1">
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{issue.key}</span>
        <PriorityBadge priority={issue.priority} />
      </div>

      <div className="rounded-md p-1 transition group-hover:bg-primary/5">
        <h4 className="line-clamp-3 text-sm font-semibold leading-5 group-hover:text-primary">{issue.title}</h4>
        <p className={`mt-1 line-clamp-3 text-xs ${issue.description ? 'text-muted-foreground' : 'text-muted-foreground/70 italic'}`}>
          {issue.description || 'No task description added yet.'}
        </p>
        {!preview && (
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
            <ExternalLink className="h-3 w-3" /> Open task details
          </div>
        )}
      </div>

      {!!labels.length && (
        <div className="mt-3 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span key={label.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: label.color ?? '#64748b' }}>{label.name}</span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>{issue.issueType?.name ?? 'Issue'}</span>
        <div className="flex min-w-0 items-center gap-2">
          {typeof issue.storyPoints === 'number' && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{issue.storyPoints} pts</span>}
          <div className="flex min-w-0 max-w-[150px] items-center gap-1.5 rounded-md bg-muted/70 px-2 py-1" title={assigneeName(issue)}>
            <UserAvatar user={issue.assignee} className="h-5 w-5 shrink-0" />
            <span className="truncate font-medium text-foreground">{assigneeName(issue)}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{comments}</span>
        <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{attachments}</span>
        <span className="inline-flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" />{subtasks}</span>
        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{watchers}</span>
        {logged > 0 && <span className="ml-auto inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{humanDuration(logged)}</span>}
      </div>
    </motion.article>
  );

  if (preview) return <div className="block">{content}</div>;

  return <Link to={detailPath} className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">{content}</Link>;
}
