import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// ✅ Global Rate Limit Handler (HTTP 429)
const handleRateLimit = err => {
    if (err.response?.status === 429) {
        toast.error('Slow down! Too many requests. Please wait a moment.', { id: 'rate-limit', icon: '⏳' });
    }
    return Promise.reject(err);
};

axios.interceptors.response.use(res => res, handleRateLimit);

const BASE = (process.env.REACT_APP_BACKEND_URL || '').trim();

// ─── AXIOS INSTANCE ───────────────────────────────────────────────────────────
// Single axios instance used everywhere — interceptor auto-refreshes on 401
export const api = axios.create({
    baseURL: BASE,
    withCredentials: true, // sends httpOnly refresh token cookie automatically
});

api.interceptors.response.use(res => res, handleRateLimit);

// In-memory access token — never touches localStorage
// Survives re-renders, lost on hard refresh (intentional — refresh endpoint restores it)
let inMemoryToken = null;

export function getToken() { return inMemoryToken; }
export function setToken(t) { inMemoryToken = t; }
export function clearToken() { inMemoryToken = null; }

// Attach token to every request
api.interceptors.request.use(config => {
    if (inMemoryToken) config.headers.Authorization = `Bearer ${inMemoryToken}`;
    return config;
});

// ─── REFRESH LOGIC ────────────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];
let initAuthPromise = null;

const processQueue = (error, token = null) => {
    failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
    failedQueue = [];
};

/**
 * Shared thread-safe refresh function
 */
export const refreshAccessToken = async () => {
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
    }

    isRefreshing = true;
    try {
        const { getFingerprint } = await import('../../utils/fingerprint');
        const fingerprint = await getFingerprint();

        const res = await axios.post(
            `${BASE}/api/auth/refresh`,
            {},
            { withCredentials: true, headers: { 'x-fingerprint': fingerprint } }
        );

        const { token, user } = res.data;
        setToken(token);
        if (user) useAuthStore.getState().setUser(user);

        processQueue(null, token);
        return token;
    } catch (err) {
        // If another request already refreshed successfully, keep that session.
        if (inMemoryToken) {
            processQueue(null, inMemoryToken);
            return inMemoryToken;
        }

        processQueue(err, null);
        clearToken();
        useAuthStore.getState().setUser(null);
        useAuthStore.getState().setInitialized(true);
        // Only redirect if we are not already on login/landing
        if (!['/login', '/landing', '/signup'].includes(window.location.pathname) && !window.location.pathname.startsWith('/profile/') && !window.location.pathname.startsWith('/stories/')) {
            window.location.href = '/login';
        }
        throw err;
    } finally {
        isRefreshing = false;
    }
};

api.interceptors.response.use(
    res => res,
    async err => {
        const original = err.config;

        if (err.response?.status !== 401 || original._retry || original.url?.includes('/auth/refresh')) {
            return Promise.reject(err);
        }

        original._retry = true;
        try {
            const newToken = await refreshAccessToken();
            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
        } catch (refreshErr) {
            return Promise.reject(refreshErr);
        }
    }
);

// ─── AUTH STORE ───────────────────────────────────────────────────────────────
const useAuthStore = create(
    devtools(
        (set, get) => ({
            user: null,
            loading: true,
            initialized: false,
            error: null,

            setUser: (user) => set({ user }),
            setInitialized: (initialized) => set({ initialized }),
            clearError: () => set({ error: null }),

            // ── Silent restore on page refresh ────────────────────────────────
            // Called once on app mount — uses httpOnly refresh token cookie
            // to get a new access token without user doing anything
            initAuth: async () => {
                if (initAuthPromise) return initAuthPromise;

                set({ loading: true });
                initAuthPromise = (async () => {
                    try {
                        // ✅ NATIVE SESSION RESTORE
                        if (Capacitor.isNativePlatform()) {
                            const { value } = await Preferences.get({ key: 'user_token' });
                            if (value) {
                                const parsed = JSON.parse(value);
                                if (parsed.token && parsed.user && (!parsed.expiresAt || parsed.expiresAt > Date.now())) {
                                    setToken(parsed.token);
                                    set({ user: parsed.user, loading: false, initialized: true });
                                    return;
                                }
                                // Token expired or invalid
                                await Preferences.remove({ key: 'user_token' });
                            }
                        }

                        // ── Fallback to cookie refresh (Web or Native with no/expired token) ──
                        await refreshAccessToken();
                        set({ loading: false, error: null, initialized: true });
                    } catch {
                        // No valid session found anywhere
                        clearToken();
                        set({ user: null, loading: false, initialized: true });
                    } finally {
                        initAuthPromise = null;
                    }
                })();

                return initAuthPromise;
            },

            // ── Login ─────────────────────────────────────────────────────────
            login: async ({ email, password, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(
                        `${BASE}/api/auth/login`,
                        { identifier: email, password, fingerprint },
                        { withCredentials: true }
                    );
                    if (res.data.requiresOtp) {
                        set({ loading: false });
                        return { requiresOtp: true, userId: res.data.userId };
                    }
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false, initialized: true });

                    if (Capacitor.isNativePlatform()) {
                        await Preferences.set({
                            key: 'user_token',
                            value: JSON.stringify({
                                token,
                                user,
                                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
                            })
                        });
                    }
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },
            // ── Google Login ──────────────────────────────────────────────────
            googleLogin: async ({ credential, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(
                        `${BASE}/api/auth/google`,
                        { credential, fingerprint },
                        { withCredentials: true }
                    );
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false, initialized: true });

                    if (Capacitor.isNativePlatform()) {
                        await Preferences.set({
                            key: 'user_token',
                            value: JSON.stringify({
                                token,
                                user,
                                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
                            })
                        });
                    }
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.error || err.response?.data?.message || 'Google Login failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            // ── Signup ────────────────────────────────────────────────────────
            signup: async ({ fullname, email, password, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(
                        `${BASE}/api/auth/add`,
                        { fullname, email, password, fingerprint },
                        { withCredentials: true }
                    );
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false, initialized: true });

                    if (Capacitor.isNativePlatform()) {
                        await Preferences.set({
                            key: 'user_token',
                            value: JSON.stringify({
                                token,
                                user,
                                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
                            })
                        });
                    }
                    return { success: true, user };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Signup failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            // ── Logout ────────────────────────────────────────────────────────
            logout: async () => {
                try {
                    await api.post('/api/auth/logout');
                } catch { }
                clearToken();
                localStorage.removeItem('socketId');
                if (Capacitor.isNativePlatform()) {
                    await Preferences.remove({ key: 'user_token' });
                }
                set({ user: null, initialized: true });
                window.location.href = '/'; // Update: Redirect to home on logout
            },

            // ── Follow / Unfollow ─────────────────────────────────────────────
            followUser: (followUserId) => {
                set(s => {
                    const following = s.user?.following || [];
                    if (following.includes(followUserId)) return s;
                    return { user: { ...s.user, following: [...following, followUserId] } };
                });
            },

            unfollowUser: (unfollowUserId) => {
                set(s => ({
                    user: {
                        ...s.user,
                        following: (s.user?.following || []).filter(id => id?.toString() !== unfollowUserId?.toString())
                    }
                }));
            },

            addMutedUser: (id) => set(s => ({
                user: s.user ? { ...s.user, mutedUsers: [...(s.user.mutedUsers || []).filter(mid => mid?.toString() !== id?.toString()), id] } : null
            })),

            removeMutedUser: (id) => set(s => ({
                user: s.user ? { ...s.user, mutedUsers: (s.user.mutedUsers || []).filter(mid => mid?.toString() !== id?.toString()) } : null
            })),

            addBlockedUser: (id) => set(s => ({
                user: s.user ? { ...s.user, blockedUsers: [...(s.user.blockedUsers || []).filter(bid => bid?.toString() !== id?.toString()), id] } : null
            })),

            removeBlockedUser: (id) => set(s => ({
                user: s.user ? { ...s.user, blockedUsers: (s.user.blockedUsers || []).filter(bid => bid?.toString() !== id?.toString()) } : null
            })),

            blockUser: async (targetUserId) => {
                const user = get().user;
                if (!user) return;
                set(s => ({
                    user: {
                        ...s.user,
                        blockedUsers: [...(s.user.blockedUsers || []), targetUserId],
                        following: (s.user.following || []).filter(id => id !== targetUserId)
                    }
                }));
                try {
                    await api.post('/api/auth/block', { targetUserId });
                } catch {
                    set(s => ({
                        user: {
                            ...s.user,
                            blockedUsers: (s.user.blockedUsers || []).filter(id => id !== targetUserId)
                        }
                    }));
                }
            },

            unblockUser: async (targetUserId) => {
                set(s => ({
                    user: {
                        ...s.user,
                        blockedUsers: (s.user.blockedUsers || []).filter(id => id !== targetUserId)
                    }
                }));
                try {
                    await api.post('/api/auth/unblock', { targetUserId });
                } catch {
                    set(s => ({
                        user: {
                            ...s.user,
                            blockedUsers: [...(s.user.blockedUsers || []), targetUserId]
                        }
                    }));
                }
            },

            muteUser: async (targetUserId) => {
                set(s => ({
                    user: {
                        ...s.user,
                        mutedUsers: [...(s.user.mutedUsers || []), targetUserId]
                    }
                }));
                try {
                    await api.post('/api/auth/mute', { targetUserId });
                } catch {
                    set(s => ({
                        user: {
                            ...s.user,
                            mutedUsers: (s.user.mutedUsers || []).filter(id => id !== targetUserId)
                        }
                    }));
                }
            },

            unmuteUser: async (targetUserId) => {
                set(s => ({
                    user: {
                        ...s.user,
                        mutedUsers: (s.user.mutedUsers || []).filter(id => id !== targetUserId)
                    }
                }));
                try {
                    await api.post('/api/auth/unmute', { targetUserId });
                } catch {
                    set(s => ({
                        user: {
                            ...s.user,
                            mutedUsers: [...(s.user.mutedUsers || []), targetUserId]
                        }
                    }));
                }
            },

            // ── Update profile ────────────────────────────────────────────────
            updateProfile: async (data) => {
                set({ loading: true });
                try {
                    const res = await api.put('/api/auth/update-profile', data);
                    set({ user: res.data, loading: false });
                    return { success: true };
                } catch (err) {
                    set({ loading: false, error: err.response?.data?.message });
                    return { error: err.response?.data?.message };
                }
            },

            // ── Verification ──────────────────────────────────────────────────
            resendVerification: async () => {
                try {
                    const res = await api.post('/api/auth/resend-verification');
                    return { success: true, message: res.data.message };
                } catch (err) {
                    return { success: false, error: err.response?.data?.error || 'Failed to resend' };
                }
            },

            verifyEmailLocally: () => {
                const user = get().user;
                if (user) {
                    set({ user: { ...user, isEmailVerified: true } });
                }
            },
        }),
        { name: 'AuthStore' }
    )
);

export default useAuthStore;
