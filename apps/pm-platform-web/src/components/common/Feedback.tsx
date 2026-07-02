import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

type Tone = 'success' | 'error' | 'warning' | 'info';
const toneClasses: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100'
};
function Icon({ tone }: { tone: Tone }) { if (tone === 'success') return <CheckCircle2 className="h-4 w-4" />; if (tone === 'info') return <Info className="h-4 w-4" />; return <AlertCircle className="h-4 w-4" />; }
export function Feedback({ tone = 'info', title, message, className }: { tone?: Tone; title?: string; message?: string; className?: string }) { if (!title && !message) return null; return <div className={cn('flex gap-2 rounded-md border p-3 text-sm', toneClasses[tone], className)}><Icon tone={tone} /><div className="space-y-0.5">{title && <div className="font-medium">{title}</div>}{message && <div className="opacity-90">{message}</div>}</div></div>; }
export function FieldError({ message }: { message?: string }) { if (!message) return null; return <p className="mt-1 text-xs text-destructive">{message}</p>; }
