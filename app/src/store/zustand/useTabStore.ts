import { create } from 'zustand';

interface TabState {
  currentTab: string;
  setTab: (tab: string) => void;
}

export const useTabStore = create<TabState>((set) => ({
  currentTab: 'feed',
  setTab: (tab: string) => set({ currentTab: tab }),
}));
