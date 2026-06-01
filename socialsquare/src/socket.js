import { io } from 'socket.io-client';

// Connects via Cloudflare custom domain (e.g. wss://api.social-square.me)
// The real Azure backend URL is NEVER exposed to the browser.
// Set REACT_APP_SOCKET_URL=https://api.social-square.me in your Vercel env vars.
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || '/';

export const socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
});
