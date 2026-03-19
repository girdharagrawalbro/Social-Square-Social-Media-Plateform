import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { socket } from '../socket';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

// Fetch notifications
const fetchNotifications = async (userId) => {
    const res = await axios.get(`${BASE}/api/conversation/notifications/${userId}`);
    return res.data;
};

// Mark notifications as read
const markAsRead = async (Ids) => {
    const res = await axios.patch(`${BASE}/api/conversation/notifications/mark-read`, { Ids });
    return res.data;
};

export function useNotifications(userId) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['notifications', userId],
        queryFn: () => fetchNotifications(userId),
        enabled: !!userId,
        staleTime: 1000 * 60, // 1 minute
    });

    // Real-time: listen for new notifications via socket
    useEffect(() => {
        if (!userId) return;

        const handleNewNotification = (notification) => {
            queryClient.setQueryData(['notifications', userId], (old = []) => [notification, ...old]);
        };

        socket.on('newNotification', handleNewNotification);
        return () => socket.off('newNotification', handleNewNotification);
    }, [userId, queryClient]);

    const markRead = useMutation({
        mutationFn: markAsRead,
        onSuccess: (_, Ids) => {
            queryClient.setQueryData(['notifications', userId], (old = []) =>
                old.filter(n => !Ids.includes(n._id))
            );
        },
    });

    const unreadCount = query.data?.length || 0;

    return { ...query, markRead, unreadCount };
}