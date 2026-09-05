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

import { queryClient } from './queryClient';

export const connectSocket = (userId: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.emit('registerUser', userId);
    console.log('[Socket] Connected and registered:', userId);

    // Global real-time cache invalidations on socket event receipts
    s.on('sessionRevoked', async () => {
      await queryClient.invalidateQueries({ queryKey: ['active_sessions'] });
      console.log('[Socket Cache Sync] Invalidated active_sessions due to session revocation');
    });

    s.on('deviceLogin', async () => {
      await queryClient.invalidateQueries({ queryKey: ['active_sessions'] });
      console.log('[Socket Cache Sync] Invalidated active_sessions due to new device login');
    });

    s.on('newFeedPost', async (post: any) => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (post && post.user) {
        const uId = post.user._id || post.user;
        await queryClient.invalidateQueries({ queryKey: ['profile_posts', uId] });
      }
      console.log('[Socket Cache Sync] Invalidated feed and user posts due to new post');
    });

    s.on('postDeleted', async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (data && data.userId) {
        await queryClient.invalidateQueries({ queryKey: ['profile_posts', data.userId] });
      }
      console.log('[Socket Cache Sync] Invalidated feed and profile posts due to post deletion');
    });

    s.on('profileUpdated', async (data: any) => {
      if (data && data.userId) {
        await queryClient.invalidateQueries({ queryKey: ['profile', data.userId] });
      }
      console.log('[Socket Cache Sync] Invalidated profile cache due to profile update');
    });

    s.on('newNotification', async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      console.log('[Socket Cache Sync] Invalidated notifications due to new notification');
    });

    s.on('conversationUpdated', async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      console.log('[Socket Cache Sync] Invalidated conversations due to conversation update');
    });

    s.on('receiveMessage', async (msg: any) => {
      if (msg && msg.conversationId) {
        await queryClient.invalidateQueries({ queryKey: ['conversations'] }); // to update snippet
      }
      console.log('[Socket Cache Sync] Invalidated messages due to new message');
    });

    s.on('followUpdate', async (data: any) => {
      if (data) {
        const targetId = data.targetId || data.requesterId;
        await queryClient.invalidateQueries({ queryKey: ['follows'] });
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
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
