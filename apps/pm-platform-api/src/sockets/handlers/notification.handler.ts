import type { Socket } from 'socket.io';
import { userRoom } from '../rooms.js';

export function registerNotificationHandlers(socket: Socket) {
  socket.on('user:join', (userId: string) => socket.join(userRoom(userId)));
}
