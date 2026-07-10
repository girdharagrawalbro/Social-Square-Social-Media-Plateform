import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';
import { appChannel } from '../../lib/broadcast';

// ─── JWT PAYLOAD UTILS ──────────────────────────────────────────────────────────
function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (
    let bc = 0, bs = 0, rbc, idx = 0;
    (rbc = str.charAt(idx++));
    ~rbc && ((bs = bc % 4 ? bs * 64 + rbc : rbc), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    rbc = chars.indexOf(rbc);
  }
  return output;
}

let inMemoryToken: string | null = null;
export function getToken() {
  return inMemoryToken;
}
export function setToken(t: string | null) {
  inMemoryToken = t;
}
export function clearToken() {
  inMemoryToken = null;
}

interface AuthState {
  user: any | null;
  token: string | null;
  sessionId: string | null;
  loading: boolean;
  initialized: boolean;
  isMaintenance: boolean;
  setUser: (user: any) => Promise<void>;
  updateAuthToken: (token: string | null, sessionId?: string) => Promise<void>;
  setInitialized: (initialized: boolean) => void;
  initAuth: () => Promise<void>;
  login: (credentials: { email: string; password?: string; fingerprint?: string }) => Promise<any>;
  signup: (details: { fullname: string; email: string; password?: string; fingerprint?: string }) => Promise<any>;
  verifyOtp: (userId: string, otpValue: string) => Promise<any>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set: any, get: any) => ({
  user: null,
  token: null,
  sessionId: null,
  loading: true,
  initialized: false,
  isMaintenance: false,

  setUser: async (user: any) => {
    if (user) {
      await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem('auth_user');
    }
    set({ user });
  },
  updateAuthToken: async (token: string | null, sessionId?: string) => {
    setToken(token);
    if (token) {
      await AsyncStorage.setItem('auth_token', token);
    } else {
      await AsyncStorage.removeItem('auth_token');
    }
    set((state: any) => ({
      token,
      ...(sessionId !== undefined ? { sessionId } : {}),
    }));
  },
  setInitialized: (initialized: boolean) => set({ initialized }),

  initAuth: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUserStr = await AsyncStorage.getItem('auth_user');

      if (storedToken && storedUserStr) {
        const storedUser = JSON.parse(storedUserStr);
        setToken(storedToken);
        set({ user: storedUser, token: storedToken, initialized: true, loading: false });

        // Verify session silently in background
        api.get('/api/auth/me')
          .then((res) => {
            if (res.data?.user) {
              get().setUser(res.data.user);
            }
          })
          .catch(() => {
            refreshAccessToken().catch(() => {
              get().logout();
            });
          });
        return;
      }

      if (storedToken) {
        setToken(storedToken);
        try {
          const res = await api.get('/api/auth/me');
          if (res.data?.user) {
            await get().setUser(res.data.user);
            set({ token: storedToken, initialized: true, loading: false });
            return;
          }
        } catch {
          await refreshAccessToken();
        }
      }

      set({ initialized: true, loading: false });
    } catch (err) {
      clearToken();
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('auth_user');
      set({ user: null, initialized: true, loading: false });
    }
  },

  login: async ({ email, password, fingerprint }: { email: string; password?: string; fingerprint?: string }) => {
    set({ loading: true });
    try {
      const res = await api.post('/api/auth/login', {
        identifier: email,
        password,
        fingerprint: fingerprint || 'mobile-device',
      });
      if (res.data.requiresOtp) {
        set({ loading: false });
        return { requiresOtp: true, userId: res.data.userId };
      }
      const { token, user, sessionId } = res.data;
      await get().updateAuthToken(token, sessionId);
      await get().setUser(user);
      set({ loading: false, initialized: true });
      return { success: true, user };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
      set({ loading: false });
      return { error: msg };
    }
  },

  signup: async ({ fullname, email, password, fingerprint }: { fullname: string; email: string; password?: string; fingerprint?: string }) => {
    set({ loading: true });
    try {
      const res = await api.post('/api/auth/add', {
        fullname,
        email,
        password,
        fingerprint: fingerprint || 'mobile-device',
      });
      const { token, user, sessionId } = res.data;
      await get().updateAuthToken(token, sessionId);
      await get().setUser(user);
      set({ loading: false, initialized: true });
      return { success: true, user };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Signup failed';
      set({ loading: false });
      return { error: msg };
    }
  },

  verifyOtp: async (userId: string, otpValue: string) => {
    set({ loading: true });
    try {
      const res = await api.post('/api/auth/verify-otp', {
        userId,
        otp: otpValue,
        fingerprint: 'mobile-device',
      });
      const { token, user, sessionId } = res.data;
      await get().updateAuthToken(token, sessionId);
      await get().setUser(user);
      set({ loading: false, initialized: true });
      return { success: true, user };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Verification failed';
      set({ loading: false });
      return { error: msg };
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // ignore
    }
    clearToken();
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    set({ user: null, token: null, sessionId: null });
    appChannel.postMessage({ type: 'LOGOUT' });
  },
}));

let refreshPromise: Promise<string | null> | null = null;
export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await api.post(
        '/api/auth/refresh',
        {},
        { headers: { 'x-fingerprint': 'mobile-device' } }
      );
      const { token, user, sessionId } = res.data;
      await useAuthStore.getState().updateAuthToken(token, sessionId);
      if (user) useAuthStore.getState().setUser(user);
      return token;
    } catch (err) {
      if (inMemoryToken) return inMemoryToken;
      clearToken();
      await AsyncStorage.removeItem('auth_token');
      useAuthStore.getState().setUser(null);
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export default useAuthStore;
