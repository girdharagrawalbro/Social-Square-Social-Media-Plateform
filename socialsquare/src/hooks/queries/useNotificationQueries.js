import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { socket } from '../../socket';
import { api } from '../../store/zustand/useAuthStore';

export const notifKeys = {
    list:     (userId) => ['notifications', userId],
    settings: (userId) => ['notifications', 'settings', userId],
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export function useNotifications(userId) {
    const qc = useQueryClient();
 
    const query = useQuery({
        queryKey: notifKeys.list(userId),
        queryFn: async () => {
            const res = await api.get(`/api/conversation/notifications`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60,
    });

    // Real-time socket injection into query cache
    useEffect(() => {
        if (!userId) return;
        const handleNew = (notification) => {
            qc.setQueryData(notifKeys.list(userId), (old = []) => [notification, ...old]);
        };
        socket.on('newNotification', handleNew);
        return () => socket.off('newNotification', handleNew);
    }, [userId, qc]);

    const markRead = useMutation({
        mutationFn: (Ids) => api.patch(`/api/conversation/notifications/mark-read`, { Ids }),
        onSuccess: (_, Ids) => {
            qc.setQueryData(notifKeys.list(userId), (old = []) =>
                old.filter(n => !Ids.includes(n._id))
            );
        },
    });

    const unreadCount = query.data?.length || 0;

    return { ...query, markRead, unreadCount };
}

// ─── NOTIFICATION SETTINGS (email digest) ─────────────────────────────────────
export function useNotificationSettings(userId) {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: notifKeys.settings(userId),
        queryFn: async () => {
            const res = await api.get(`/api/auth/notification-settings`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10,
    });

    const updateSettings = useMutation({
        mutationFn: (settings) => api.patch(`/api/auth/notification-settings`, settings),
        onSuccess: (res) => {
            qc.setQueryData(notifKeys.settings(userId), res.data);
        },
    });

    return { ...query, updateSettings };
}