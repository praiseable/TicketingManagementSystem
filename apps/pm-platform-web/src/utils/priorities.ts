import { AlertTriangle, ArrowDown, ChevronsUp, Minus, SignalHigh } from 'lucide-react';
import type { Priority } from '@/types';

export const priorityConfig: Record<Priority, { label: string; className: string; icon: typeof Minus }> = {
  CRITICAL: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', icon: AlertTriangle },
  HIGH: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', icon: ChevronsUp },
  MEDIUM: { label: 'Medium', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', icon: SignalHigh },
  LOW: { label: 'Low', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: ArrowDown },
  NONE: { label: 'None', className: 'bg-muted text-muted-foreground', icon: Minus }
};
