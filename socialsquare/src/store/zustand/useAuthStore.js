import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

const useAuthStore = create(
    devtools(
        persist(
            (set, get) => ({
                // ─── State ────────────────────────────────────────────────────
                user: null,
                token: localStorage.getItem('token') || null,
                loading: false,
                error: null,

                // ─── Setters ──────────────────────────────────────────────────
                setUser: (user) => set({ user }),
                setToken: (token) => {
                    localStorage.setItem('token', token);
                    set({ token });
                },
                clearError: () => set({ error: null }),

                // ─── Fetch logged user ────────────────────────────────────────
                fetchUser: async () => {
                    set({ loading: true });
                    try {
                        // ① Always try to get a fresh access token via the httpOnly refresh cookie
                        const { getFingerprint } = await import('../../utils/fingerprint');
                        const fingerprint = await getFingerprint();``
                        const refreshRes = await axios.post(
                            `${BASE}/api/auth/refresh`,
                            {},
                            { withCredentials: true, headers: { 'x-fingerprint': fingerprint } }
                        );
                        const freshToken = refreshRes.data.token;
                        localStorage.setItem('token', freshToken);
                        set({ token: freshToken });

                        // ② Now fetch the user with the fresh token
                        const res = await axios.get(`${BASE}/api/auth/get`, {
                            headers: { Authorization: `Bearer ${freshToken}` },
                        });
                        set({ user: res.data, loading: false, error: null });
                    } catch (err) {
                        // Refresh failed — token truly expired, force logout
                        if (err.response?.status === 401 || err.response?.status === 403) {
                            localStorage.removeItem('token');
                            set({ user: null, token: null, loading: false });
                        } else {
                            set({ loading: false, error: err.response?.data?.message || 'Failed to fetch user' });
                        }
                    }
                },

                // ─── Login ────────────────────────────────────────────────────
                login: async ({ email, password, fingerprint }) => {
                    set({ loading: true, error: null });
                    try {
                        const res = await axios.post(`${BASE}/api/auth/login`,
                            { identifier: email, password, fingerprint },
                            { withCredentials: true }
                        );
                        if (res.data.requiresOtp) {
                            set({ loading: false });
                            return { requiresOtp: true, email };
                        }
                        const { token, user } = res.data;
                        localStorage.setItem('token', token);
                        set({ token, user, loading: false });
                        return { success: true };
                    } catch (err) {
                        const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
                        set({ loading: false, error: msg });
                        return { error: msg };
                    }
                },

                // ─── Signup ───────────────────────────────────────────────────
                signup: async ({ fullname, email, password, fingerprint }) => {
                    set({ loading: true, error: null });
                    try {
                        const res = await axios.post(`${BASE}/api/auth/add`,
                            { fullname, email, password, fingerprint },
                            { withCredentials: true }
                        );
                        const { token, user } = res.data;
                        localStorage.setItem('token', token);
                        set({ token, user, loading: false });
                        return { success: true };
                    } catch (err) {
                        const msg = err.response?.data?.message || 'Signup failed';
                        set({ loading: false, error: msg });
                        return { error: msg };
                    }
                },

                // ─── Google OAuth ─────────────────────────────────────────────
                googleAuth: async ({ credential, fingerprint }) => {
                    set({ loading: true, error: null });
                    try {
                        const res = await axios.post(`${BASE}/api/auth/google`,
                            { credential, fingerprint },
                            { withCredentials: true }
                        );
                        const { token, user } = res.data;
                        localStorage.setItem('token', token);
                        set({ token, user, loading: false });
                        return { success: true };
                    } catch (err) {
                        const msg = err.response?.data?.message || 'Google auth failed';
                        set({ loading: false, error: msg });
                        return { error: msg };
                    }
                },

                // ─── Logout ───────────────────────────────────────────────────
                logout: async () => {
                    const token = get().token;
                    try {
                        await axios.post(`${BASE}/api/auth/logout`, {}, {
                            headers: { Authorization: `Bearer ${token}` },
                            withCredentials: true,
                        });
                    } catch { }
                    localStorage.removeItem('token');
                    localStorage.removeItem('socketId');
                    sessionStorage.removeItem('hasReloaded');
                    set({ user: null, token: null });
                },

                // ─── Follow / Unfollow ────────────────────────────────────────
                followUser: async (followUserId) => {
                    const token = get().token;
                    const user = get().user;
                    // Optimistic update
                    set(state => ({
                        user: { ...state.user, following: [...(state.user?.following || []), followUserId] }
                    }));
                    try {
                        await axios.post(`${BASE}/api/auth/follow`,
                            { loggedUserId: user._id, followUserId },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } catch {
                        // Rollback
                        set(state => ({
                            user: { ...state.user, following: state.user.following.filter(id => id !== followUserId) }
                        }));
                    }
                },

                unfollowUser: async (unfollowUserId) => {
                    const token = get().token;
                    const user = get().user;
                    set(state => ({
                        user: { ...state.user, following: state.user.following.filter(id => id !== unfollowUserId) }
                    }));
                    try {
                        await axios.post(`${BASE}/api/auth/unfollow`,
                            { loggedUserId: user._id, unfollowUserId },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } catch {
                        set(state => ({
                            user: { ...state.user, following: [...(state.user?.following || []), unfollowUserId] }
                        }));
                    }
                },

                // ─── Update profile ───────────────────────────────────────────
                updateProfile: async (data) => {
                    const token = get().token;
                    set({ loading: true });
                    try {
                        const res = await axios.put(`${BASE}/api/auth/update-profile`, data, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        set({ user: res.data, loading: false });
                        return { success: true };
                    } catch (err) {
                        set({ loading: false, error: err.response?.data?.message });
                        return { error: err.response?.data?.message };
                    }
                },
            }),
            {
                name: 'auth-store',
                // Only persist token — user is fetched fresh on mount
                partialize: (state) => ({ token: state.token }),
            }
        ),
        { name: 'AuthStore' }
    )
);

export default useAuthStore;