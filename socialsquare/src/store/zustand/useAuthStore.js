import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';

const BASE = (process.env.REACT_APP_BACKEND_URL || '').trim();

// ─── AXIOS INSTANCE ───────────────────────────────────────────────────────────
// Single axios instance used everywhere — interceptor auto-refreshes on 401
export const api = axios.create({
    baseURL: BASE,
    withCredentials: true, // sends httpOnly refresh token cookie automatically
});

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
        if (!['/login', '/landing', '/signup'].includes(window.location.pathname)) {
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
                        // refreshAccessToken already sets the token and user in the store
                        await refreshAccessToken();
                        set({ loading: false, error: null, initialized: true });
                    } catch {
                        // No valid refresh token — user needs to log in
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
                    return { success: true };
                } catch (err) {
                    const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
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
                    return { success: true };
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
                set({ user: null, initialized: true });
                window.location.href = '/'; // Update: Redirect to home on logout
            },

            // ── Follow / Unfollow ─────────────────────────────────────────────
            followUser: async (followUserId) => {
                const user = get().user;
                set(s => ({ user: { ...s.user, following: [...(s.user?.following || []), followUserId] } }));
                try {
                    await api.post('/api/auth/follow', { userId: user._id, followUserId });
                } catch {
                    set(s => ({ user: { ...s.user, following: s.user.following.filter(id => id !== followUserId) } }));
                }
            },

            unfollowUser: async (unfollowUserId) => {
                const user = get().user;
                set(s => ({ user: { ...s.user, following: s.user.following.filter(id => id !== unfollowUserId) } }));
                try {
                    await api.post('/api/auth/unfollow', { userId: user._id, unfollowUserId });
                } catch {
                    set(s => ({ user: { ...s.user, following: [...(s.user?.following || []), unfollowUserId] } }));
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