import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { socket } from '../socket';
import { api } from '../store/zustand/useAuthStore';

// Fetch notifications
const fetchNotifications = async (userId, page = 1) => {
    const res = await api.get(`/api/conversation/notifications?page=${page}&limit=20`);
    return res.data; // { notifications, total, page, hasNextPage }
};

// Mark notifications as read
const markAsRead = async (Ids) => {
    const res = await api.patch(`/api/conversation/notifications/mark-read`, { Ids });
    return res.data;
};

export function useNotifications(userId) {
    const [allNotifications, setAllNotifications] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const query = useQuery({
        queryKey: ['notifications', userId, page],
        queryFn: () => fetchNotifications(userId, page),
        enabled: !!userId,
        staleTime: 1000 * 60,
    });

    useEffect(() => {
        if (query.data?.notifications) {
            const { notifications, hasNextPage } = query.data;
            setAllNotifications(prev => {
                const existingIds = new Set(prev.map(n => n._id));
                const uniqueNew = notifications.filter(n => !existingIds.has(n._id));
                return [...prev, ...uniqueNew];
            });
            setHasMore(hasNextPage);
        }
    }, [query.data]);

    // Real-time: listen for new notifications via socket
    useEffect(() => {
        if (!userId) return;
        const handleNewNotification = (notification) => {
            setAllNotifications(prev => [notification, ...prev]);
        };
        socket.on('newNotification', handleNewNotification);
        return () => socket.off('newNotification', handleNewNotification);
    }, [userId]);

    const markRead = useMutation({
        mutationFn: markAsRead,
        onSuccess: (_, Ids) => {
            setAllNotifications(prev =>
                prev.map(n => Ids.includes(n._id) ? { ...n, read: true } : n)
            );
        },
    });

    const unreadCount = allNotifications.filter(n => !n.read).length;

    return {
        data: allNotifications,
        markRead,
        unreadCount,
        isLoading: query.isLoading,
        loadMore: () => setPage(p => p + 1),
        hasMore
    };
}