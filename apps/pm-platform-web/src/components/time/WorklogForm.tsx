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
  startAt: z.string().min(1, 'Start time is required'),
  endAt: z.string().min(1, 'End time is required'),
  description: z.string().optional(),
}).refine((values) => {
  const start = new Date(values.startAt).getTime();
  const end = new Date(values.endAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}, {
  path: ['endAt'],
  message: 'End time must be after start time',
});

type Values = z.infer<typeof schema>;

function toLocalDateTime(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function addSeconds(value: string | Date, seconds: number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + Math.max(60, seconds) * 1000);
}

function intervalSeconds(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return 0;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 1000));
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

export function WorklogForm({
  issueId,
  defaultSeconds = 1800,
  worklog,
  onSaved,
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

  const startDate = worklog?.dateStarted ? new Date(worklog.dateStarted) : new Date();
  const endDate = addSeconds(startDate, worklog?.timeSpent ?? defaultSeconds);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      startAt: toLocalDateTime(startDate),
      endAt: toLocalDateTime(endDate),
      description: worklog?.description ?? '',
    },
  });

  const watchedStart = form.watch('startAt');
  const watchedEnd = form.watch('endAt');
  const computedSeconds = intervalSeconds(watchedStart, watchedEnd);

  function setQuickDuration(seconds: number) {
    const start = form.getValues('startAt') || toLocalDateTime(new Date());
    form.setValue('endAt', toLocalDateTime(addSeconds(start, seconds)), { shouldDirty: true, shouldValidate: true });
  }

  function submit(values: Values) {
    const timeSpent = intervalSeconds(values.startAt, values.endAt);
    if (!timeSpent) {
      form.setError('endAt', { message: 'End time must be after start time' });
      return;
    }

    const body = {
      timeSpent,
      dateStarted: new Date(values.startAt).toISOString(),
      description: values.description?.trim() || null,
    };

    if (isEditing && worklog) {
      update.mutate({ worklogId: worklog.id, body }, { onSuccess: onSaved });
    } else {
      create.mutate(body, { onSuccess: onSaved });
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="font-medium">Log work by time interval</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter when the work started and ended. The system calculates the duration automatically; users no longer enter raw seconds.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Start time</Label>
          <Input type="datetime-local" {...form.register('startAt')} />
          {form.formState.errors.startAt?.message && <p className="mt-1 text-xs text-destructive">{form.formState.errors.startAt.message}</p>}
        </div>
        <div>
          <Label>End time</Label>
          <Input type="datetime-local" {...form.register('endAt')} />
          {form.formState.errors.endAt?.message && <p className="mt-1 text-xs text-destructive">{form.formState.errors.endAt.message}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Quick duration:</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setQuickDuration(15 * 60)}>15m</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setQuickDuration(30 * 60)}>30m</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setQuickDuration(60 * 60)}>1h</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setQuickDuration(2 * 60 * 60)}>2h</Button>
        <span className="ml-auto rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
          Calculated: {humanDuration(computedSeconds)}
        </span>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea placeholder="What work was done?" {...form.register('description')} />
      </div>

      <Button disabled={pending}>{pending ? 'Saving…' : isEditing ? 'Update worklog' : 'Save worklog'}</Button>
    </form>
  );
}
