import { create } from 'zustand';
import type { TimerSession } from '@/types';

interface TimerState { timers: Record<string, TimerSession>; setTimer: (timer: TimerSession) => void; removeTimer: (issueId: string) => void; setElapsed: (issueId: string, elapsedSeconds: number) => void; activeTimer: () => TimerSession | undefined; }
export const useTimerStore = create<TimerState>((set, get) => ({
  timers: {},
  setTimer: (timer) => set((state) => ({ timers: { ...state.timers, [timer.issueId]: timer } })),
  removeTimer: (issueId) => set((state) => { const timers = { ...state.timers }; delete timers[issueId]; return { timers }; }),
  setElapsed: (issueId, elapsedSeconds) => set((state) => ({ timers: { ...state.timers, [issueId]: { ...state.timers[issueId], elapsedSeconds } } })),
  activeTimer: () => Object.values(get().timers).find((timer) => timer.status === 'ACTIVE')
}));
