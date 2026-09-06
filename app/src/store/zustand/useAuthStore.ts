import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';
import { appChannel } from '../../lib/broadcast';
import { clearAllCache } from '../../lib/cache';
import { setSecureToken, getSecureToken, clearSecureToken } from '../../lib/secureStore';

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

export function getToken() {
  return useAuthStore.getState().token;
}

export interface User {
  _id: string;
  fullname: string;
  email: string;
  profile_picture?: string;
  bio?: string;
  username?: string;
  isVerified?: boolean;
  [key: string]: any; // fallback for other dynamic fields
}

interface AuthState {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  loading: boolean;
  initialized: boolean;
  isMaintenance: boolean;
  setUser: (user: User | null) => Promise<void>;
  updateAuthToken: (token: string | null, sessionId?: string) => Promise<void>;
  setInitialized: (initialized: boolean) => void;
  initAuth: () => Promise<void>;
  login: (credentials: { email: string; password?: string; fingerprint?: string }) => Promise<any>;
  googleLogin: (credentials: { credential: string; fingerprint?: string }) => Promise<any>;
  signup: (details: { fullname: string; email: string; password?: string; fingerprint?: string }) => Promise<any>;
  verifyOtp: (userId: string, otpValue: string) => Promise<any>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  sessionId: null,
  loading: true,
  initialized: false,
  isMaintenance: false,

  setUser: async (user: User | null) => {
    if (user) {
      await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem('auth_user');
    }
    set({ user });
  },
  updateAuthToken: async (token: string | null, sessionId?: string) => {
    if (token) {
      await setSecureToken(token);
    } else {
      await clearSecureToken();
    }
    set((state) => ({
      token,
      ...(sessionId !== undefined ? { sessionId } : {}),
    }));
  },
  setInitialized: (initialized: boolean) => set({ initialized }),

  initAuth: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const storedToken = await getSecureToken();
      const storedUserStr = await AsyncStorage.getItem('auth_user');

      if (storedToken && storedUserStr) {
        const storedUser = JSON.parse(storedUserStr);
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
      await clearSecureToken();
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
        return {
          requiresOtp: true,
          userId: res.data.userId,
          otpExpireTime: res.data.otpExpireTime,
          resendDuration: res.data.resendDuration,
        };
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

  googleLogin: async ({ credential, fingerprint }: { credential: string; fingerprint?: string }) => {
    set({ loading: true });
    try {
      const res = await api.post('/api/auth/google', {
        credential,
        fingerprint: fingerprint || 'mobile-device',
      });
      const { token, user, sessionId } = res.data;
      await get().updateAuthToken(token, sessionId);
      await get().setUser(user);
      set({ loading: false, initialized: true });
      return { success: true, user };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Google login failed';
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
    // Only hit the endpoint if there's actually a session to invalidate — avoids a
    // repeated-call cascade when this is invoked again after already logging out
    // (e.g. a second forceLogout() fired while the first logout() was in flight).
    if (get().token) {
      try {
        await api.post('/api/auth/logout');
      } catch (e) {}
    }
    await clearSecureToken();
    await AsyncStorage.removeItem('auth_user');
    // Clear all app-side cache on logout so next user gets fresh data
    await clearAllCache();
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
      // Always call logout + throw so the interceptor can redirect to Login.
      // Do NOT return a stale token — that causes an infinite 401 retry loop.
      await useAuthStore.getState().logout();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export default useAuthStore;
