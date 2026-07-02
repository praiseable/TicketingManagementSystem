import { cn } from '@/utils/cn';

type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

const toneClass: Record<FeedbackTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Feedback({ tone = 'info', title, message, className }: { tone?: FeedbackTone; title?: string; message?: string; className?: string }) {
  if (!title && !message) return null;

  return (
    <div className={cn('rounded-lg border p-3 text-sm', toneClass[tone], className)} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      {title && <div className="font-semibold">{title}</div>}
      {message && <div className="mt-1 whitespace-pre-line">{message}</div>}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600" role="alert">{message}</p>;
}
