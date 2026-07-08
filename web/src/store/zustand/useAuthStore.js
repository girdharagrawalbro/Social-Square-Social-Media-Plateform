import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';
import toast from '../../utils/toast.js';
import performLogout from '../../utils/performLogout';
import { appChannel } from "../../utils/broadcast";
import dbService from '../../utils/indexedDb';

// ─── UTILS ───────────────────────────────────────────────────────────────────
const handleRateLimit = err => {
    if (err.response?.status === 429) {
        toast.error('Slow down! Too many requests. Please wait a moment.', { id: 'rate-limit', icon: '⏳' });
    }
    return Promise.reject(err);
};

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

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
            sessionId: null,
            loading: true,
            initialized: false,
            error: null,
            isMaintenance: false,

            setUser: (user) => set({ user }),
            fetchAndSetRelationships: async () => {
                if (!getToken() || !get().user) return;
                try {
                    const [relRes, savedRes] = await Promise.all([
                        api.get('/api/auth/relationship-ids'),
                        api.get('/api/post/saved-ids')
                    ]);
                    const { following, followers } = relRes.data;
                    set(state => ({
                        user: state.user ? { ...state.user, following, followers } : null
                    }));
                    const postStoreModule = await import('./usePostStore');
                    const usePostStore = postStoreModule.default;
                    if (usePostStore) {
                        usePostStore.getState().initSavedIds(savedRes.data || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch relationships and saved post IDs:', err);
                }
            },
            updateAuthToken: (token, sessionId) => {
                setToken(token);
                set(state => {
                    const updates = { token };
                    if (sessionId !== undefined) {
                        updates.sessionId = sessionId;
                    }
                    return updates;
                });
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
                        // 1. Silent Refresh: Check for existing session via httpOnly cookie
                        // This allows sessions to persist across tab closes/reloads
                        await refreshAccessToken();
                        set({ loading: false, error: null, initialized: true });
                    } catch (err) {
                        if (err.response?.status === 503 || err.response?.data?.code === 'MAINTENANCE_MODE') {
                            set({ isMaintenance: true, loading: false, initialized: true });
                            return;
                        }
                        const isOffline = !navigator.onLine || err.message === 'Network Error' || err.code === 'ERR_NETWORK';
                        if (isOffline) {
                            try {
                                const cachedUser = await dbService.getCache('own_profile');
                                if (cachedUser) {
                                    set({ user: cachedUser, loading: false, error: null, initialized: true });
                                    return;
                                }
                            } catch (cacheErr) {
                                console.error('Failed to load cached user profile:', cacheErr);
                            }
                        }
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
                    const res = await api.post(`/api/auth/login`, { identifier: email, password, fingerprint });
                    if (res.data.requiresOtp) { set({ loading: false }); return { requiresOtp: true, userId: res.data.userId }; }
                    const { token, user, sessionId } = res.data;
                    get().updateAuthToken(token, sessionId);
                    set({ user, loading: false, initialized: true });
                    get().fetchAndSetRelationships();
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            googleLogin: async ({ credential, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await api.post(`/api/auth/google`, { credential, fingerprint });
                    const { token, user, sessionId } = res.data;
                    get().updateAuthToken(token, sessionId);
                    set({ user, loading: false, initialized: true });
                    get().fetchAndSetRelationships();
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
                    const res = await api.post(`/api/auth/add`, { fullname, email, password, fingerprint });
                    const { token, user, sessionId } = res.data;
                    get().updateAuthToken(token, sessionId);
                    set({ user, loading: false, initialized: true });
                    get().fetchAndSetRelationships();
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Signup failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            logout: async () => {
                try {
                    await api.post("/api/auth/logout");
                } catch { }

                await performLogout();

                appChannel.postMessage({
                    type: "LOGOUT",
                });
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
                    return { success: true, user: userData, privacyWarning: res.data.privacyWarning };
                } catch (err) {
                    set({ loading: false, error: err.response?.data?.message });
                    return { error: err.response?.data?.message };
                }
            },

            verifyEmailLocally: () => {
                set(s => ({
                    user: s.user ? { ...s.user, isEmailVerified: true } : null
                }));
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
            const res = await api.post(`/api/auth/refresh`, {}, { withCredentials: true, headers: { 'x-fingerprint': fingerprint } });
            const { token, user, sessionId } = res.data;
            useAuthStore.getState().updateAuthToken(token, sessionId);
            if (user) {
                useAuthStore.getState().setUser(user);
                useAuthStore.getState().fetchAndSetRelationships();
            }
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
api.interceptors.response.use(res => {
    if (typeof res.data === 'string' && res.data) {
        try { res.data = JSON.parse(res.data); } catch (e) { }
    }
    return res;
}, handleRateLimit);
api.interceptors.response.use(
    res => res,
    async err => {
        const originalRequest = err.config;
        if (err.response?.status === 503 && err.response?.data?.code === 'MAINTENANCE_MODE') {
            useAuthStore.setState({ isMaintenance: true });
            return Promise.reject(err);
        }
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
                    if (useAuthStore.getState().user) {
                        appChannel.postMessage({
                            type: "SESSION_EXPIRED",
                            reason: refreshErr.response?.data?.error || "Your session has expired. Please log in again."
                        });
                    }
                    reject(refreshErr);
                })
                .finally(() => {
                    isRefreshing = false;
                });
        });
    }
);

export default useAuthStore;
