import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWorklog, useUpdateWorklog } from '@/hooks/useWorklogs';
import type { Worklog } from '@/types';

const schema = z.object({
  timeSpent: z.coerce.number().int().positive(),
  dateStarted: z.string().min(1),
  description: z.string().optional()
});

type Values = z.infer<typeof schema>;

function toLocalDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function WorklogForm({
  issueId,
  defaultSeconds = 1800,
  worklog,
  onSaved
}: {
  issueId: string;
  defaultSeconds?: number;
  worklog?: Worklog | null;
  onSaved?: () => void;
}) {
  const create = useCreateWorklog(issueId);
  const update = useUpdateWorklog(issueId);
  const isEditing = Boolean(worklog?.id);
  const pending = create.isPending || update.isPending;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      timeSpent: worklog?.timeSpent ?? defaultSeconds,
      dateStarted: toLocalDateTime(worklog?.dateStarted),
      description: worklog?.description ?? ''
    }
  });

  function submit(values: Values) {
    const body = {
      ...values,
      dateStarted: new Date(values.dateStarted).toISOString(),
      description: values.description?.trim() || null
    };
    if (isEditing && worklog) {
      update.mutate({ worklogId: worklog.id, body }, { onSuccess: onSaved });
    } else {
      create.mutate(body, { onSuccess: onSaved });
    }
  }

  return <form className="space-y-3" onSubmit={form.handleSubmit(submit)}>
    <div>
      <Label>Seconds</Label>
      <Input type="number" min={1} {...form.register('timeSpent')} />
      <p className="mt-1 text-xs text-muted-foreground">Time is stored in seconds. 1 hour = 3600 seconds.</p>
    </div>
    <div>
      <Label>Date started</Label>
      <Input type="datetime-local" {...form.register('dateStarted')} />
    </div>
    <div>
      <Label>Description</Label>
      <Textarea placeholder="What work was done?" {...form.register('description')} />
    </div>
    <Button disabled={pending}>{pending ? 'Saving…' : isEditing ? 'Update worklog' : 'Save worklog'}</Button>
  </form>;
}
