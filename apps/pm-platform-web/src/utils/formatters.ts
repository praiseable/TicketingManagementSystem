import { format, formatDistanceToNow } from 'date-fns';

export function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(Math.floor(totalSeconds), 0);
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy');
}

export function timeAgo(value?: string | Date | null) {
  if (!value) return '—';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function formatBytes(bytes?: number | bigint | null) {
  const value = Number(bytes ?? 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
