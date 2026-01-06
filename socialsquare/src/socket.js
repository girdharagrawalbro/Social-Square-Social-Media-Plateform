import { io } from 'socket.io-client';
export const socket = io("https://social-square-social-media-plateform-uwd8.onrender.com", {
    withCredentials: true
});
