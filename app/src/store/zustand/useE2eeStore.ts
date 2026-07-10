import { create } from 'zustand';

interface E2eeState {
  initE2ee: (userId: string, password: string) => Promise<boolean>;
  getConversationKey: (conversationId: string, recipientId: string) => Promise<string | null>;
}

export const useE2eeStore = create<E2eeState>(() => ({
  initE2ee: async (userId: string, password: string) => {
    // Simple E2EE mock on mobile client side
    return true;
  },
  getConversationKey: async (conversationId: string, recipientId: string) => {
    // Return a mock AES key for the simple cryptoUtils to proceed without throwing
    return 'mock-conversation-aes-key';
  },
}));

export default useE2eeStore;
