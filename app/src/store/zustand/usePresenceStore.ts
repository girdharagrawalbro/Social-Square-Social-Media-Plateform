import { create } from 'zustand';

interface PresenceEntry {
  isOnline: boolean;
  lastSeen: string | null;
}

interface PresenceState {
  byUserId: Record<string, PresenceEntry>;
  setOnline: (userId: string) => void;
  setOffline: (userId: string, lastSeen?: string | null) => void;
  seed: (userId: string, entry: PresenceEntry) => void;
}

// Live presence, fed by the socket's userOnline/userOffline broadcasts (see
// src/lib/socket.ts). REST (`/api/auth/online-status/:id`) only seeds the
// initial value before the first socket event arrives for that user.
export const usePresenceStore = create<PresenceState>((set) => ({
  byUserId: {},
  setOnline: (userId) => set((s) => ({
    byUserId: { ...s.byUserId, [userId]: { isOnline: true, lastSeen: null } },
  })),
  setOffline: (userId, lastSeen = new Date().toISOString()) => set((s) => ({
    byUserId: { ...s.byUserId, [userId]: { isOnline: false, lastSeen } },
  })),
  seed: (userId, entry) => set((s) => ({
    byUserId: { ...s.byUserId, [userId]: entry },
  })),
}));
