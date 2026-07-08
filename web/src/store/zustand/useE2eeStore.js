import { create } from 'zustand';
import useAuthStore, { api } from './useAuthStore';
import {
  generateKeyPair,
  exportKeyToJWK,
  importKeyFromJWK,
  encryptPrivateKey,
  decryptPrivateKey,
  generateSymmetricKey,
  exportSymmetricKey,
  importSymmetricKey,
  encryptSymmetricKeyWithRSA,
  decryptSymmetricKeyWithRSA,
  decryptText,
} from '../../utils/cryptoUtils';
import toast from '../../utils/toast.js';
import dbService from '../../utils/indexedDb';

const useE2eeStore = create((set, get) => ({
  privateKey: null, // Decrypted active CryptoKey in memory
  publicKeyJWK: null, // User's public key in JWK format
  loading: false,
  error: null,
  cachedPublicKeys: {}, // userId -> CryptoKey (imported)
  cachedConversationKeys: {}, // conversationId -> CryptoKey (imported)

  /**
   * Initializes E2EE for the logged-in user.
   * Checks local storage, pulls from backend if needed, or generates a new key pair.
   * @param {string} userId
   * @param {string} password - Password or PIN used to derive decryption key
   */
  initE2ee: async (userId, password) => {
    if (!userId) return;
    set({ loading: true, error: null });

    try {
      // 1. Check local storage for private key first (JWK)
      const localPrivateKeyVal = await dbService.get(`e2ee_private_key_${userId}`);
      const localPublicKeyVal = await dbService.get(`e2ee_public_key_${userId}`);

      if (localPrivateKeyVal && localPublicKeyVal) {
        try {
          const privateJWK = JSON.parse(localPrivateKeyVal);
          const publicJWK = JSON.parse(localPublicKeyVal);
          const privateKey = await importKeyFromJWK(privateJWK, 'private');
          set({ privateKey, publicKeyJWK: publicJWK, loading: false });
          return { success: true, keysGenerated: false };
        } catch (e) {
          console.error("Local E2EE keys import failed, pulling from backend...", e);
        }
      }
      if (!password) {
        set({ loading: false, error: "Password required to retrieve E2EE keys" });
        return { success: false, error: "password_required" };
      }

      // 2. Fetch from backend if local key doesn't exist/fail
      const res = await api.get(`/api/e2ee/keys/${userId}`).catch(() => null);
      if (res && res.data && res.data.encryptedPrivateKey && res.data.encryptedPrivateKey.ciphertext) {
        const { ciphertext, iv, salt } = res.data.encryptedPrivateKey;
        try {
          // Decrypt private key using user's password
          const privateKey = await decryptPrivateKey(ciphertext, iv, salt, password);
          const privateJWK = await exportKeyToJWK(privateKey);
          const publicJWK = JSON.parse(res.data.publicKey);

          // Save keys locally
          await dbService.set(`e2ee_private_key_${userId}`, JSON.stringify(privateJWK));
          await dbService.set(`e2ee_public_key_${userId}`, JSON.stringify(publicJWK));

          set({ privateKey, publicKeyJWK: publicJWK, loading: false });
          return { success: true, keysGenerated: false };
        } catch (e) {
          console.error("Failed to decrypt server backed up private key", e);
          set({ loading: false, error: "Incorrect E2EE password or corrupt key." });
          return { success: false, error: "incorrect_password" };
        }
      }

      // 3. Generate a brand-new key pair if no backend/local key exists
      toast.loading('Setting up End-to-End Encryption keys...', { id: 'e2ee-gen' });
      const keyPair = await generateKeyPair();
      const publicJWK = await exportKeyToJWK(keyPair.publicKey);
      const privateJWK = await exportKeyToJWK(keyPair.privateKey);

      // Encrypt the private key using password for backup
      const backupData = await encryptPrivateKey(keyPair.privateKey, password);

      // Save to backend
      await api.post('/api/e2ee/keys', {
        publicKey: JSON.stringify(publicJWK),
        encryptedPrivateKey: backupData,
      });

      // Save locally
      await dbService.set(`e2ee_private_key_${userId}`, JSON.stringify(privateJWK));
      await dbService.set(`e2ee_public_key_${userId}`, JSON.stringify(publicJWK));

      set({ privateKey: keyPair.privateKey, publicKeyJWK: publicJWK, loading: false });
      toast.success('End-to-End Encryption activated!', { id: 'e2ee-gen' });
      return { success: true, keysGenerated: true };
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to initialize E2EE keys';
      set({ loading: false, error: msg });
      toast.error(msg, { id: 'e2ee-gen' });
      return { success: false, error: msg };
    }
  },

  /**
   * Retrieves a target user's public key (RSA-OAEP) and caches it in memory.
   * @param {string} targetUserId
   * @returns {Promise<CryptoKey|null>}
   */
  getPublicKey: async (targetUserId) => {
    const cached = get().cachedPublicKeys[targetUserId];
    if (cached) return cached;

    try {
      const res = await api.get(`/api/e2ee/keys/${targetUserId}`);
      if (!res.data || !res.data.publicKey) return null;

      const jwk = JSON.parse(res.data.publicKey);
      const publicKey = await importKeyFromJWK(jwk, 'public');

      set((state) => ({
        cachedPublicKeys: {
          ...state.cachedPublicKeys,
          [targetUserId]: publicKey,
        },
      }));
      return publicKey;
    } catch (err) {
      console.error(`Failed to get public key for user ${targetUserId}:`, err);
      return null;
    }
  },

  /**
   * Retrieves or creates the symmetric AES conversation key.
   * Encrypts the key for participants and stores it on the backend.
   * @param {string} conversationId
   * @param {string} recipientId
   * @returns {Promise<CryptoKey|null>}
   */
  getConversationKey: async (conversationId, recipientId) => {
    let key = get().cachedConversationKeys[conversationId];
    if (key) return key;

    const myId = useAuthStore.getState().user?._id;
    const myPrivateKey = get().privateKey;
    if (!myPrivateKey) return null;

    try {
      // 1. Check local storage for the encrypted conversation key
      const localValue = await dbService.get(`e2ee_convo_key_${myId}_${conversationId}`);
      if (localValue) {
        try {
          const base64AesKey = await decryptSymmetricKeyWithRSA(localValue, myPrivateKey);
          const importedKey = await importSymmetricKey(base64AesKey);
          set(state => ({
            cachedConversationKeys: { ...state.cachedConversationKeys, [conversationId]: importedKey }
          }));
          return importedKey;
        } catch (e) {
          console.warn("Failed to decrypt locally cached conversation key, fetching from backend:", e);
        }
      }

      // 2. Fetch from backend if not found or decryption failed
      const res = await api.get(`/api/e2ee/conversation-key/${conversationId}`).catch(() => null);
      if (res && res.data && res.data.encryptedKey) {
        // Cache the encrypted key locally
        await dbService.set(`e2ee_convo_key_${myId}_${conversationId}`, res.data.encryptedKey);

        const base64AesKey = await decryptSymmetricKeyWithRSA(res.data.encryptedKey, myPrivateKey);
        const importedKey = await importSymmetricKey(base64AesKey);
        set(state => ({
          cachedConversationKeys: { ...state.cachedConversationKeys, [conversationId]: importedKey }
        }));
        return importedKey;
      }

      // 3. Generate a new conversation key if none exists
      const newSymmetricKey = await generateSymmetricKey();
      const base64Key = await exportSymmetricKey(newSymmetricKey);
      const keysToUpload = [];

      const myPublicKeyJWK = get().publicKeyJWK;
      const myPublicKey = await importKeyFromJWK(myPublicKeyJWK, 'public');
      const myEncryptedKey = await encryptSymmetricKeyWithRSA(base64Key, myPublicKey);
      keysToUpload.push({ userId: myId, encryptedKey: myEncryptedKey });

      // Cache our own encrypted key locally
      await dbService.set(`e2ee_convo_key_${myId}_${conversationId}`, myEncryptedKey);

      if (recipientId) {
        const recipientPublicKey = await get().getPublicKey(recipientId);
        if (recipientPublicKey) {
          const recipientEncryptedKey = await encryptSymmetricKeyWithRSA(base64Key, recipientPublicKey);
          keysToUpload.push({ userId: recipientId, encryptedKey: recipientEncryptedKey });
        }
      }

      await api.post('/api/e2ee/conversation-keys', {
        conversationId,
        keys: keysToUpload
      });

      set(state => ({
        cachedConversationKeys: { ...state.cachedConversationKeys, [conversationId]: newSymmetricKey }
      }));

      return newSymmetricKey;
    } catch (err) {
      console.error("Failed to get/create conversation key:", err);
      return null;
    }
  },

  /**
   * Decrypts an incoming message (either text or media) in-place if encrypted.
   * @param {object} message
   * @param {string} [recipientId]
   * @returns {Promise<object>} Decrypted message
   */
  decryptMessage: async (message, recipientId = null) => {
    if (!message || !message.isEncrypted) return message;
    const myPrivateKey = get().privateKey;
    if (!myPrivateKey) return message;

    const unescapeHtml = (str) => {
      if (!str) return str;
      return str
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    };

    try {
      const aesKey = await get().getConversationKey(message.conversationId, recipientId);
      if (aesKey) {
        if (message.content) {
          const contentUnescaped = unescapeHtml(message.content);
          if (contentUnescaped.startsWith('{')) {
            try {
              const encryptedObj = JSON.parse(contentUnescaped);
              if (encryptedObj.ciphertext && encryptedObj.iv) {
                message.content = await decryptText(encryptedObj.ciphertext, encryptedObj.iv, aesKey);
              }
            } catch (e) {
              console.error("Failed to parse/decrypt content for message:", message._id, e);
            }
          }
        }
        if (message.media && message.media.url) {
          const urlUnescaped = unescapeHtml(message.media.url);
          if (urlUnescaped.startsWith('{')) {
            try {
              const encryptedUrlObj = JSON.parse(urlUnescaped);
              if (encryptedUrlObj.ciphertext && encryptedUrlObj.iv) {
                message.media.url = await decryptText(encryptedUrlObj.ciphertext, encryptedUrlObj.iv, aesKey);
              }
            } catch (e) {
              console.error("Failed to decrypt media url for message:", message._id, e);
            }
          }
        }
        if (message.media && message.media.name) {
          const nameUnescaped = unescapeHtml(message.media.name);
          if (nameUnescaped.startsWith('{')) {
            try {
              const encryptedNameObj = JSON.parse(nameUnescaped);
              if (encryptedNameObj.ciphertext && encryptedNameObj.iv) {
                const decryptedMetadataStr = await decryptText(encryptedNameObj.ciphertext, encryptedNameObj.iv, aesKey);
                const metadata = JSON.parse(decryptedMetadataStr);
                message.media.name = metadata.name;
                message.media.fileKey = metadata.key;
                message.media.fileIv = metadata.iv;
              }
            } catch (e) {
              console.error("Failed to decrypt media name for message:", message._id, e);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to decrypt message:", message._id, err);
      message.content = "🔑 [Decryption Failed]";
    }
    return message;
  },

  /**
   * Clears the decrypted private key from memory and local storage.
   */
  clearKeys: async (userId) => {
    await dbService.remove(`e2ee_private_key_${userId}`);
    await dbService.remove(`e2ee_public_key_${userId}`);
    set({ privateKey: null, publicKeyJWK: null, cachedPublicKeys: {}, cachedConversationKeys: {} });
  },
}));

export default useE2eeStore;
