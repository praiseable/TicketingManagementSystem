import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisConnection } from '@pm-platform/db';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { pageRoom, projectRoom, spaceRoom, userRoom } from './rooms.js';
import { registerBoardHandlers } from './handlers/board.handler.js';
import { registerNotificationHandlers } from './handlers/notification.handler.js';
import { registerTimerHandlers } from './handlers/timer.handler.js';

let io: Server | undefined;

export async function setupSocket(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.FRONTEND_URL, credentials: true } });

  const pub = createRedisConnection();
  const sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub));

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) return next(new Error('unauthorized'));

    try {
      const payload = verifyAccessToken(String(token));
      socket.data.user = payload;
      socket.join(userRoom(payload.sub));
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('project:join', (projectId: string) => socket.join(projectRoom(projectId)));
    socket.on('space:join', (spaceId: string) => socket.join(spaceRoom(spaceId)));

    socket.on('page:join', (payload: { spaceId?: string; pageId?: string }) => {
      if (payload?.spaceId) socket.join(spaceRoom(payload.spaceId));
      if (payload?.pageId) socket.join(pageRoom(payload.pageId));
      socket.to(payload?.pageId ? pageRoom(payload.pageId) : spaceRoom(payload?.spaceId ?? '')).emit('page:presence', {
        pageId: payload?.pageId,
        user: socket.data.user,
        state: 'joined',
        at: new Date().toISOString()
      });
    });

    socket.on('page:editing', (payload: { spaceId?: string; pageId?: string; selection?: unknown }) => {
      if (!payload?.pageId) return;
      socket.to(pageRoom(payload.pageId)).emit('page:editing', {
        pageId: payload.pageId,
        user: socket.data.user,
        selection: payload.selection ?? null,
        at: new Date().toISOString()
      });
    });

    registerBoardHandlers(io!, socket);
    registerNotificationHandlers(socket);
    registerTimerHandlers(socket);
  });

  return io;
}

export function getIO() {
  if (!io) return undefined;
  return io;
}

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(projectRoom(projectId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToSpace(spaceId: string, event: string, payload: unknown) {
  io?.to(spaceRoom(spaceId)).emit(event, payload);
}

export function emitToPage(pageId: string, event: string, payload: unknown) {
  io?.to(pageRoom(pageId)).emit(event, payload);
}
