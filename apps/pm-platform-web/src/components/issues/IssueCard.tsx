import { Link } from 'react-router-dom';
import { MessageSquare, Paperclip, Eye, Clock3 } from 'lucide-react';
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

export function IssueCard({ issue, preview = false }: { issue: Issue; preview?: boolean }) {
  const labels = (issue.labels ?? []).map((item: any) => labelOf(item)).filter(Boolean).slice(0, 3);
  const comments = issue._count?.comments ?? issue.comments?.length ?? 0;
  const attachments = issue._count?.attachments ?? issue.attachments?.length ?? 0;
  const watchers = issue._count?.watchers ?? 0;
  const logged = timeLogged(issue);
  const Wrapper = preview ? 'div' : Link;
  const props = preview ? {} : { to: `/projects/${issue.projectId}/issues/${issue.id}` };

  return (
    <Wrapper {...props as any} className="block">
      <motion.article
        layout
        className="group relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-lg"
      >
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: issue.workflowStatus?.color ?? '#64748b' }} />
        <div className="mb-2 flex items-start justify-between gap-2 pt-1">
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{issue.key}</span>
          <PriorityBadge priority={issue.priority} />
        </div>

        <h4 className="line-clamp-3 text-sm font-semibold leading-5 group-hover:text-primary">{issue.title}</h4>
        {issue.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{issue.description}</p>}

        {!!labels.length && (
          <div className="mt-3 flex flex-wrap gap-1">
            {labels.map((label) => (
              <span key={label.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: label.color ?? '#64748b' }}>{label.name}</span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{issue.issueType?.name ?? 'Issue'}</span>
          <div className="flex items-center gap-2">
            {typeof issue.storyPoints === 'number' && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{issue.storyPoints} pts</span>}
            <UserAvatar user={issue.assignee} className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{comments}</span>
          <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{attachments}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{watchers}</span>
          {logged > 0 && <span className="ml-auto inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{Math.round(logged / 3600)}h</span>}
        </div>
      </motion.article>
    </Wrapper>
  );
}

