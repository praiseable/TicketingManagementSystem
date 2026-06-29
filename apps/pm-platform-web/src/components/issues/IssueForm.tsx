import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { issuesApi } from '@/api/issues.api';
import { projectsApi } from '@/api/projects.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).default('MEDIUM'),
  issueTypeId: z.string().optional(),
  assigneeId: z.string().optional(),
  storyPoints: z.coerce.number().int().min(0).optional().or(z.literal('').transform(() => undefined)),
  dueDate: z.string().optional(),
  labelsText: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

type MemberRow = { user: { id: string; name: string; email: string; isActive?: boolean } };
type IssueTypeRow = { id: string; name: string };

export function IssueForm({ projectId, workflowStatusId, onDone }: { projectId: string; workflowStatusId?: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ['project-members', projectId], queryFn: () => projectsApi.members(projectId) as Promise<MemberRow[]>, enabled: Boolean(projectId) });
  const { data: issueTypes = [] } = useQuery({ queryKey: ['issue-types', projectId], queryFn: () => projectsApi.issueTypes(projectId) as Promise<IssueTypeRow[]>, enabled: Boolean(projectId) });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', priority: 'MEDIUM', issueTypeId: '', assigneeId: '', labelsText: '', dueDate: '' }
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => {
      const labels = (values.labelsText ?? '').split(',').map((item) => item.trim()).filter(Boolean);
      return issuesApi.create(projectId, {
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        workflowStatusId,
        issueTypeId: values.issueTypeId || undefined,
        assigneeId: values.assigneeId || null,
        storyPoints: values.storyPoints ?? undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
        labels
      } as any);
    },
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      qc.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      qc.setQueryData(queryKeys.issue(issue.id), issue);
      onDone?.();
    }
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
      <div>
        <Label>Title</Label>
        <Input {...form.register('title')} autoFocus placeholder="What needs to be done?" />
        {form.formState.errors.title && <p className="mt-1 text-xs text-destructive">{form.formState.errors.title.message}</p>}
      </div>

      <div>
        <Label>Description</Label>
        <Textarea {...form.register('description')} className="min-h-28" placeholder="Add acceptance criteria, context, or notes…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Issue type</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register('issueTypeId')}>
            <option value="">Default type</option>
            {issueTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Assignee</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register('assigneeId')}>
            <option value="">Unassigned</option>
            {members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name} · {member.user.email}</option>)}
          </select>
        </div>
        <div>
          <Label>Priority</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register('priority')}>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="NONE">None</option>
          </select>
        </div>
        <div>
          <Label>Story points</Label>
          <Input type="number" min={0} {...form.register('storyPoints')} placeholder="0" />
        </div>
        <div>
          <Label>Due date</Label>
          <Input type="date" {...form.register('dueDate')} />
        </div>
        <div>
          <Label>Labels</Label>
          <Input {...form.register('labelsText')} placeholder="frontend, urgent" />
        </div>
      </div>

      {create.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{(create.error as Error).message}</div>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create issue'}</Button>
      </div>
    </form>
  );
}

