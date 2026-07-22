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

    // Global real-time cache invalidations on socket event receipts
    s.on('sessionRevoked', async () => {
      const { invalidateCache } = require('./cache');
      await invalidateCache('active_sessions');
      console.log('[Socket Cache Sync] Invalidated active_sessions due to session revocation');
    });

    s.on('deviceLogin', async () => {
      const { invalidateCache } = require('./cache');
      await invalidateCache('active_sessions');
      console.log('[Socket Cache Sync] Invalidated active_sessions due to new device login');
    });

    s.on('newFeedPost', async (post: any) => {
      const { invalidateCache } = require('./cache');
      await invalidateCache('feed');
      if (post && post.user) {
        const uId = post.user._id || post.user;
        await invalidateCache(`profile_posts_${uId}`);
      }
      console.log('[Socket Cache Sync] Invalidated feed and user posts due to new post');
    });

    s.on('postDeleted', async (data: any) => {
      const { invalidateCache } = require('./cache');
      await invalidateCache('feed');
      if (data && data.userId) {
        await invalidateCache(`profile_posts_${data.userId}`);
      }
      console.log('[Socket Cache Sync] Invalidated feed and profile posts due to post deletion');
    });

    s.on('profileUpdated', async (data: any) => {
      const { invalidateCache } = require('./cache');
      if (data && data.userId) {
        await invalidateCache(`profile_${data.userId}`);
      }
      console.log('[Socket Cache Sync] Invalidated profile cache due to profile update');
    });

    s.on('newNotification', async () => {
      const { invalidateCache } = require('./cache');
      await invalidateCache('notifications');
      console.log('[Socket Cache Sync] Invalidated notifications due to new notification');
    });

    s.on('conversationUpdated', async () => {
      const { invalidateCache } = require('./cache');
      await invalidateCache('conversations');
      console.log('[Socket Cache Sync] Invalidated conversations due to conversation update');
    });

    s.on('receiveMessage', async (msg: any) => {
      const { invalidateCache } = require('./cache');
      if (msg && msg.conversationId) {
        await invalidateCache(`chat_messages_${msg.conversationId}`);
      }
      console.log('[Socket Cache Sync] Invalidated messages due to new message');
    });

    s.on('followUpdate', async (data: any) => {
      const { invalidateCache } = require('./cache');
      if (data) {
        const targetId = data.targetId || data.requesterId;
        await invalidateCache(`follows_following_${userId}`);
        await invalidateCache(`follows_followers_${userId}`);
        await invalidateCache(`follows_following_${userId}_limit100`);
        if (targetId) {
          await invalidateCache(`follows_following_${targetId}`);
          await invalidateCache(`follows_followers_${targetId}`);
          await invalidateCache(`follows_following_${targetId}_limit100`);
          await invalidateCache(`profile_${targetId}`);
        }
        await invalidateCache(`profile_${userId}`);
      }
      console.log('[Socket Cache Sync] Invalidated follows list and profiles due to followUpdate');
    });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log('[Socket] Disconnected');
  }
};
