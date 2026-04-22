import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../store/zustand/useAuthStore';
import useConversationStore from '../store/zustand/useConversationStore';

// Fetch notifications
const fetchNotifications = async (userId, page = 1) => {
    const res = await api.get(`/api/conversation/notifications?page=${page}&limit=20`);
    return res.data; // { notifications, total, page, hasNextPage }
};

// Mark notifications as read in backend
const markAsReadBackend = async (Ids) => {
    const res = await api.patch(`/api/conversation/notifications/mark-read`, { Ids });
    return res.data;
};

export function useNotifications(userId) {
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const {
        notifications,
        unreadNotificationsCount,
        setNotifications,
        markNotificationsRead
    } = useConversationStore();

    const query = useQuery({
        queryKey: ['notifications', userId, page],
        queryFn: () => fetchNotifications(userId, page),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes stale time as we have socket
    });

    useEffect(() => {
        if (query.data?.notifications) {
            const { notifications: fetchedNotifications, hasNextPage } = query.data;

            // Merge with existing notifications in store
            setNotifications(fetchedNotifications);
            // Note: If we are on page > 1, we might want to append. 
            // But for simplicity and frequency, we sync the store with the latest view.

            setHasMore(hasNextPage);
        }
    }, [query.data, setNotifications]);

    // Real-time: listener is already in AppInit, but we can keep it here for local safety if needed
    // However, AppInit is better for global state. 
    // We'll rely on AppInit calling useConversationStore.addNotification

    const markRead = useMutation({
        mutationFn: markAsReadBackend,
        onMutate: async (Ids) => {
            // Optimistic update
            markNotificationsRead(Ids);
        },
        onSuccess: () => {
            // Success - store already updated optimistically
        },
    });

    return {
        data: notifications,
        markRead,
        unreadCount: unreadNotificationsCount,
        isLoading: query.isLoading,
        loadMore: () => setPage(p => p + 1),
        hasMore
    };
}
