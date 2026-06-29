import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWorklog } from '@/hooks/useWorklogs';

const schema = z.object({ timeSpent: z.coerce.number().int().positive(), dateStarted: z.string(), description: z.string().optional() });
export function WorklogForm({ issueId, defaultSeconds = 1800, onSaved }: { issueId: string; defaultSeconds?: number; onSaved?: () => void }) { const create = useCreateWorklog(issueId); const form = useForm({ resolver: zodResolver(schema), defaultValues: { timeSpent: defaultSeconds, dateStarted: new Date().toISOString().slice(0, 16), description: '' } }); return <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate({ ...values, dateStarted: new Date(values.dateStarted).toISOString() }, { onSuccess: onSaved }))}><div><Label>Seconds</Label><Input type="number" {...form.register('timeSpent')} /></div><div><Label>Date started</Label><Input type="datetime-local" {...form.register('dateStarted')} /></div><div><Label>Description</Label><Textarea {...form.register('description')} /></div><Button disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Save worklog'}</Button></form>; }
