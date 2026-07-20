import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
};

export const connectSocket = (userId: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.emit('registerUser', userId);
    console.log('[Socket] Connected and registered:', userId);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log('[Socket] Disconnected');
  }
};
