import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisConnection } from '@pm-platform/db';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { projectRoom, userRoom, spaceRoom } from './rooms.js';
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
