import { create } from 'zustand';

interface LiveState {
  liveStreamId: string | null;
  isLiveHost: boolean;
  setLiveStream: (id: string, isHost: boolean) => void;
  clearLiveStream: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  liveStreamId: null,
  isLiveHost: false,
  setLiveStream: (id, isHost) => set({ liveStreamId: id, isLiveHost: isHost }),
  clearLiveStream: () => set({ liveStreamId: null, isLiveHost: false }),
}));
