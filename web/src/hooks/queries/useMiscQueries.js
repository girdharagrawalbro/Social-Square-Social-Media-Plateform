import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useAuthStore, { api, getToken } from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const miscKeys = {
    activeSessions: (userId) => ['sessions', 'active', userId],
    userInfo: (userId) => ['user', 'info', userId],
    chatbot: ['chatbot', 'conversation'],
    systemFlags: ['system', 'flags'],
};

// ─── ACTIVE SESSIONS ───────────────────────────────────────────────────────────
export function useActiveSessions(userId) {
    return useQuery({
        queryKey: miscKeys.activeSessions(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/sessions`);
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: !!userId,
        staleTime: 1000 * 60, // 1 minute - sessions can change
        refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    });
}

// ─── USER INFO FOR ACTIVE SESSIONS ────────────────────────────────────────────
export function useSessionUserInfo(userId) {
    return useQuery({
        queryKey: miscKeys.userInfo(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/user/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── TOGGLE 2FA ────────────────────────────────────────────────────────────────
export function useToggle2FA() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: async () => {
            const res = await api.post(`${BASE}/api/auth/toggle-2fa`, {});
            return res.data;
        },
        onSuccess: () => {
            // Invalidate user info cache
            qc.invalidateQueries({ queryKey: miscKeys.userInfo(user?._id) });
        },
    });
}

// ─── CHATBOT MESSAGE ───────────────────────────────────────────────────────────
export function useChatbot() {
    return useMutation({
        mutationFn: async ({ prompt, conversationHistory }) => {
            const token = getToken();
            const res = await fetch(`${BASE}/api/chatbot/chat`, {
                method: 'POST',
                headers: { 
                     'Content-Type': 'application/json',
                     'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ prompt, conversationHistory }),
            });
            if (!res.ok) throw new Error('Chatbot error');
            return res.json();
        },
    });
}

// ─── SYSTEM FLAGS ─────────────────────────────────────────────────────────────
export function useSystemFlags() {
    const user = useAuthStore(s => s.user);
    return useQuery({
        queryKey: miscKeys.systemFlags,
        queryFn: async () => {
            const res = await api.get(`/api/auth/system/flags`);
            return res.data?.flags || {};
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 10, // Cache settings for 10 minutes to avoid refetching
        gcTime: 1000 * 60 * 30,    // Cache garbage collection in 30 minutes
    });
}
