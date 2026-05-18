import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// ─── UTILS ───────────────────────────────────────────────────────────────────
const handleRateLimit = err => {
    if (err.response?.status === 429) {
        toast.error('Slow down! Too many requests. Please wait a moment.', { id: 'rate-limit', icon: '⏳' });
    }
    return Promise.reject(err);
};

const BASE = process.env.NGINIX ? "" : process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// ─── AUTH STORE DEFINITION (First to avoid TDZ) ───────────────────────────────
let inMemoryToken = null;
export function getToken() { return inMemoryToken; }
export function setToken(t) { inMemoryToken = t; }
export function clearToken() { inMemoryToken = null; }

let initAuthPromise = null;
let refreshPromise = null;

const useAuthStore = create(
    devtools(
        (set, get) => ({
            user: null,
            token: null,
            loading: true,
            initialized: false,
            error: null,

            setUser: (user) => set({ user }),
            updateAuthToken: (token) => {
                setToken(token);
                set({ token });
            },
            setInitialized: (initialized) => set({ initialized }),
            clearError: () => set({ error: null }),

            getUserIdFromToken: () => {
                const token = getToken();
                if (!token) return null;
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
                    return payload.userId || payload.id || payload.sub || null;
                } catch { return null; }
            },

            initAuth: async () => {
                if (get().initialized) return;
                if (initAuthPromise) return initAuthPromise;
                set({ loading: true });
                initAuthPromise = (async () => {
                    try {
                        if (Capacitor.isNativePlatform()) {
                            const { value } = await Preferences.get({ key: 'user_token' });
                            if (value) {
                                const parsed = JSON.parse(value);
                                if (parsed.token && parsed.user && (!parsed.expiresAt || parsed.expiresAt > Date.now())) {
                                    const payload = JSON.parse(atob(parsed.token.split('.')[1]));
                                    const isExpired = payload.exp && payload.exp * 1000 < Date.now();

                                    if (!isExpired) {
                                        get().updateAuthToken(parsed.token);
                                        set({ user: parsed.user, loading: false });
                                        set({ initialized: true });
                                        return;
                                    }
                                }
                                await Preferences.remove({ key: 'user_token' });
                            }
                        }
                        // 1. Silent Refresh: Check for existing session via httpOnly cookie
                        // This allows sessions to persist across tab closes/reloads
                        await refreshAccessToken();
                        set({ loading: false, error: null, initialized: true });
                    } catch (err) {
                        clearToken();
                        set({ user: null, loading: false, initialized: true });
                    } finally {
                        initAuthPromise = null;
                    }
                })();
                return initAuthPromise;
            },

            login: async ({ email, password, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(`${BASE}/api/auth/login`, { identifier: email, password, fingerprint }, { withCredentials: true });
                    if (res.data.requiresOtp) { set({ loading: false }); return { requiresOtp: true, userId: res.data.userId }; }
                    const { token, user } = res.data;
                    get().updateAuthToken(token);
                    set({ user, loading: false, initialized: true });
                    if (Capacitor.isNativePlatform()) {
                        await Preferences.set({ key: 'user_token', value: JSON.stringify({ token, user, expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) }) });
                    }
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Login failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            googleLogin: async ({ credential, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(`${BASE}/api/auth/google`, { credential, fingerprint }, { withCredentials: true });
                    const { token, user } = res.data;
                    get().updateAuthToken(token);
                    set({ user, loading: false, initialized: true });
                    if (Capacitor.isNativePlatform()) {
                        await Preferences.set({ key: 'user_token', value: JSON.stringify({ token, user, expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) }) });
                    }
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.error || 'Google login failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            signup: async ({ fullname, email, password, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(`${BASE}/api/auth/add`, { fullname, email, password, fingerprint }, { withCredentials: true });
                    const { token, user } = res.data;
                    get().updateAuthToken(token);
                    set({ user, loading: false, initialized: true });
                    if (Capacitor.isNativePlatform()) {
                        await Preferences.set({ key: 'user_token', value: JSON.stringify({ token, user, expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) }) });
                    }
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Signup failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },



            logout: async () => {
                try { await api.post('/api/auth/logout'); } catch { }
                clearToken();
                if (Capacitor.isNativePlatform()) await Preferences.remove({ key: 'user_token' });
                set({ user: null, initialized: true });
                window.location.href = '/';
            },

            // ── Basic Actions (others can be added later) ──
            followUser: (id) => set(s => ({ user: { ...s.user, following: [...(s.user?.following || []), id] } })),
            unfollowUser: (id) => set(s => ({ user: { ...s.user, following: (s.user?.following || []).filter(fid => fid?.toString() !== id?.toString()) } })),
            addBlockedUser: (id) => set(s => ({ user: { ...s.user, blockedUsers: [...(s.user?.blockedUsers || []), id] } })),
            removeBlockedUser: (id) => set(s => ({ user: { ...s.user, blockedUsers: (s.user?.blockedUsers || []).filter(bid => bid?.toString() !== id?.toString()) } })),

            updateProfile: async (data) => {
                set({ loading: true });
                try {
                    const res = await api.put('/api/auth/update-profile', data);
                    const userData = res.data.user || res.data;
                    set({ user: userData, loading: false });
                    const { getQueryClient } = await import('../../queryClient');
                    getQueryClient()?.invalidateQueries({ queryKey: ['user', 'me'] });
                    return { success: true };
                } catch (err) {
                    set({ loading: false, error: err.response?.data?.message });
                    return { error: err.response?.data?.message };
                }
            }
        }),
        { name: 'AuthStore' }
    )
);

// ─── REFRESH LOGIC (Depends on useAuthStore) ──────────────────────────────────
export const refreshAccessToken = () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const { getFingerprint } = await import('../../utils/fingerprint');
            const fingerprint = await getFingerprint();
            const res = await axios.post(`${BASE}/api/auth/refresh`, {}, { withCredentials: true, headers: { 'x-fingerprint': fingerprint } });
            const { token, user } = res.data;
            useAuthStore.getState().updateAuthToken(token);
            if (user) useAuthStore.getState().setUser(user);
            return token;
        } catch (err) {
            if (inMemoryToken) return inMemoryToken;
            clearToken();
            useAuthStore.getState().setUser(null);
            throw err;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

// ─── AXIOS INSTANCE ───────────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

export const api = axios.create({ baseURL: BASE, withCredentials: true });
api.interceptors.request.use(config => {
    if (inMemoryToken) config.headers.Authorization = `Bearer ${inMemoryToken}`;
    // Generate a simple unique ID for this request to enable client->server tracing
    config.headers['x-request-id'] = `req-${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
    return config;
});
api.interceptors.response.use(res => res, handleRateLimit);
api.interceptors.response.use(
    res => res,
    async err => {
        const originalRequest = err.config;
        if (err.response?.status !== 401 || originalRequest._retry || originalRequest.url?.includes('/auth/refresh')) {
            return Promise.reject(err);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
                .then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                })
                .catch(err => {
                    return Promise.reject(err);
                });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        return new Promise((resolve, reject) => {
            refreshAccessToken()
                .then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    processQueue(null, token);
                    resolve(api(originalRequest));
                })
                .catch(refreshErr => {
                    processQueue(refreshErr, null);
                    reject(refreshErr);
                })
                .finally(() => {
                    isRefreshing = false;
                });
        });
    }
);

export default useAuthStore;
