import type { Socket } from 'socket.io';
import { userRoom } from '../rooms.js';

export function registerTimerHandlers(socket: Socket) {
  socket.on('timer:join', (userId: string) => socket.join(userRoom(userId)));
}
