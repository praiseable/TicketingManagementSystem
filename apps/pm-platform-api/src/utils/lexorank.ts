export function positionBetween(previous?: number | null, next?: number | null): number {
  if (previous == null && next == null) return 1024;
  if (previous == null && next != null) return next / 2;
  if (previous != null && next == null) return previous + 1024;
  return ((previous as number) + (next as number)) / 2;
}

export function reorderPosition(items: { id: string; position: number }[], id: string, targetIndex: number) {
  const sorted = items.filter((item) => item.id !== id).sort((a, b) => a.position - b.position);
  const previous = sorted[targetIndex - 1]?.position ?? null;
  const next = sorted[targetIndex]?.position ?? null;
  return positionBetween(previous, next);
}
