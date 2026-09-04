import { create } from 'zustand';
import * as Keychain from 'react-native-keychain';

interface E2eeState {
  getConversationKey: (conversationId: string) => Promise<string | null>;
  setConversationKey: (conversationId: string, key: string) => Promise<void>;
  removeConversationKey: (conversationId: string) => Promise<void>;
}

export const useE2eeStore = create<E2eeState>(() => ({
  getConversationKey: async (conversationId: string) => {
    try {
      const credentials = await Keychain.getGenericPassword({ service: `e2ee_${conversationId}` });
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (e) {
      console.warn('Failed to get conversation key', e);
      return null;
    }
  },
  setConversationKey: async (conversationId: string, key: string) => {
    try {
      await Keychain.setGenericPassword('key', key, { 
        service: `e2ee_${conversationId}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (e) {
      console.warn('Failed to set conversation key', e);
    }
  },
  removeConversationKey: async (conversationId: string) => {
    try {
      await Keychain.resetGenericPassword({ service: `e2ee_${conversationId}` });
    } catch (e) {
      console.warn('Failed to remove conversation key', e);
    }
  }
}));

export default useE2eeStore;
