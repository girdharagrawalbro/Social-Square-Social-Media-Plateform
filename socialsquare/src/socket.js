import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_NGINIX ? "" : process.env.REACT_APP_BACKEND_URL;

export const socket = io(BACKEND_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
});
