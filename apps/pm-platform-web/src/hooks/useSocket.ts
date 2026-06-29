import { useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useTimerStore } from '@/stores/timer.store';
import { queryKeys } from '@/api/queryKeys';
import type { Issue } from '@/types';

let socket: Socket | null = null;

type IssueResult = { data: Issue[]; meta?: unknown };

function mergeIssueIntoQueries(qc: ReturnType<typeof useQueryClient>, issue: Issue) {
  if (!issue?.id) return;
  const projectId = issue.projectId;
  const queries = qc.getQueriesData<IssueResult>({ queryKey: projectId ? ['issues', projectId] : ['issues'] });

  for (const [key, previous] of queries) {
    if (!previous?.data) continue;
    let found = false;
    const data = previous.data.map((row) => {
      if (row.id !== issue.id) return row;
      found = true;
      return { ...row, ...issue, workflowStatus: issue.workflowStatus ?? row.workflowStatus, workflowStatusId: issue.workflowStatusId ?? issue.workflowStatus?.id ?? row.workflowStatusId };
    });
    if (found) qc.setQueryData<IssueResult>(key, { ...previous, data });
  }

  qc.setQueryData(queryKeys.issue(issue.id), (previous: Issue | undefined) => previous ? { ...previous, ...issue } : issue);
}

export function useSocket(currentProjectId?: string) {
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const timerStore = useTimerStore();

  useEffect(() => {
    if (!token || !user) return;

    socket?.disconnect();
    socket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:3001', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      socket?.emit('user:join', user.id);
      if (currentProjectId) socket?.emit('project:join', currentProjectId);
    });

    socket.on('issue:updated', (issue?: Issue) => {
      if (issue?.id) mergeIssueIntoQueries(qc, issue);
      else qc.invalidateQueries({ queryKey: ['issues'], refetchType: 'none' });
    });

    socket.on('issue:transitioned', (issue?: Issue) => {
      if (issue?.id) mergeIssueIntoQueries(qc, issue);
      else qc.invalidateQueries({ queryKey: ['issues'], refetchType: 'none' });
    });

    socket.on('notification:new', () => qc.invalidateQueries({ queryKey: ['notifications'] }));
    socket.on('timer:tick', (payload) => timerStore.setTimer(payload));
    socket.on('timer:stopped', (payload) => timerStore.removeTimer(payload.issueId));

    socket.on('board:reordered', (payload?: { issues?: Issue[] }) => {
      if (Array.isArray(payload?.issues)) payload.issues.forEach((issue) => mergeIssueIntoQueries(qc, issue));
      else qc.invalidateQueries({ queryKey: ['issues'], refetchType: 'none' });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [token, user?.id, currentProjectId, qc]);

  return useMemo(() => socket, [token, user?.id, currentProjectId]);
}
