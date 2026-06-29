import type { Server, Socket } from 'socket.io';
import { projectRoom } from '../rooms.js';

export function registerBoardHandlers(io: Server, socket: Socket) {
  socket.on('board:join', (projectId: string) => socket.join(projectRoom(projectId)));
  socket.on('board:reordered', (payload) => io.to(projectRoom(payload.projectId)).except(socket.id).emit('board:reordered', payload));
}
