import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { timersApi } from '@/api/timers.api';
import { useTimerStore } from '@/stores/timer.store';

export function useTimer(issueId: string) {
  const store = useTimerStore();
  const timer = store.timers[issueId];
  const [localElapsed, setLocalElapsed] = useState(timer?.elapsedSeconds ?? timer?.accumulatedSeconds ?? 0);
  useQuery({ queryKey: ['timers', 'active'], queryFn: timersApi.active, staleTime: 0, refetchOnWindowFocus: true, select: (data) => { data.forEach(store.setTimer); return data; } });
  useEffect(() => { setLocalElapsed(timer?.elapsedSeconds ?? timer?.accumulatedSeconds ?? 0); if (!timer || timer.status !== 'ACTIVE') return; const id = window.setInterval(() => setLocalElapsed((value) => value + 1), 1000); return () => window.clearInterval(id); }, [timer?.issueId, timer?.status, timer?.elapsedSeconds, timer?.accumulatedSeconds]);
  const start = useMutation({ mutationFn: () => timersApi.start(issueId), onSuccess: store.setTimer });
  const pause = useMutation({ mutationFn: () => timersApi.pause(issueId), onSuccess: store.setTimer });
  const stop = useMutation({ mutationFn: () => timersApi.stop(issueId), onSuccess: () => store.removeTimer(issueId) });
  return useMemo(() => ({ timer, elapsed: localElapsed, start, pause, stop }), [timer, localElapsed, start, pause, stop]);
}
