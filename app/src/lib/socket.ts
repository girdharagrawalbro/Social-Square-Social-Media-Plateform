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
import { usePresenceStore } from '../store/zustand/usePresenceStore';
import { queryKeys } from './queryKeys';

export const connectSocket = (userId: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.emit('registerUser', userId);
    console.log('[Socket] Connected and registered:', userId);

    // Global real-time cache invalidations on socket event receipts
    s.on('sessionRevoked', async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.activeSessions() });
      console.log('[Socket Cache Sync] Invalidated active_sessions due to session revocation');
    });

    s.on('deviceLogin', async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.activeSessions() });
      console.log('[Socket Cache Sync] Invalidated active_sessions due to new device login');
    });

    s.on('newFeedPost', async (post: any) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.feedAll() });
      if (post && post.user) {
        const uId = post.user._id || post.user;
        await queryClient.invalidateQueries({ queryKey: queryKeys.profilePosts(uId) });
      }
      console.log('[Socket Cache Sync] Invalidated feed and user posts due to new post');
    });

    s.on('postDeleted', async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.feedAll() });
      if (data && data.userId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profilePosts(data.userId) });
      }
      console.log('[Socket Cache Sync] Invalidated feed and profile posts due to post deletion');
    });

    s.on('profileUpdated', async (data: any) => {
      if (data && data.userId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile(data.userId) });
      }
      console.log('[Socket Cache Sync] Invalidated profile cache due to profile update');
    });

    s.on('newNotification', async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      console.log('[Socket Cache Sync] Invalidated notifications due to new notification');
    });

    s.on('conversationUpdated', async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations() });
      console.log('[Socket Cache Sync] Invalidated conversations due to conversation update');
    });

    s.on('receiveMessage', async (msg: any) => {
      if (msg && msg.conversationId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations() }); // to update snippet
      }
      console.log('[Socket Cache Sync] Invalidated messages due to new message');
    });

    // Presence — backend broadcasts these globally on connect/disconnect (server/index.js),
    // but nothing consumed them client-side before, so any open chat's online/offline
    // indicator only ever changed via a REST poll (or never, if that endpoint 404'd).
    s.on('userOnline', (data: any) => {
      const userId = typeof data === 'string' ? data : data?.userId;
      if (userId) usePresenceStore.getState().setOnline(userId);
    });

    s.on('userOffline', (data: any) => {
      const userId = typeof data === 'string' ? data : data?.userId;
      if (userId) usePresenceStore.getState().setOffline(userId);
    });

    s.on('followUpdate', async (data: any) => {
      if (data) {
        const targetId = data.targetId || data.requesterId;
        await queryClient.invalidateQueries({ queryKey: queryKeys.follows() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.profileAll() });
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
