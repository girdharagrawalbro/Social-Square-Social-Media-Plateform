import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_NGINIX === 'true' ? '' : process.env.REACT_APP_BACKEND_URL;
const A = `${BASE}/api/activity`;

export const activityKeys = {
    posts: () => ['activity', 'posts'],
    saved: () => ['activity', 'saved'],
    liked: () => ['activity', 'liked'],
    comments: () => ['activity', 'comments'],
    stories: () => ['activity', 'stories'],
    interactions: (type) => ['activity', 'interactions', type],
    muted: () => ['activity', 'muted'],
    notInterested: () => ['activity', 'not-interested'],
    interested: () => ['activity', 'interested'],
    timeSpent: () => ['activity', 'time-spent'],
    account: () => ['activity', 'account'],
};

export function useActivityPosts() {
    return useQuery({ queryKey: activityKeys.posts(), queryFn: () => api.get(`${A}/posts`).then(r => r.data), staleTime: 60000 });
}

export function useActivitySaved() {
    return useQuery({ queryKey: activityKeys.saved(), queryFn: () => api.get(`${A}/saved`).then(r => r.data), staleTime: 60000 });
}

export function useActivityLiked() {
    return useQuery({ queryKey: activityKeys.liked(), queryFn: () => api.get(`${A}/liked`).then(r => r.data), staleTime: 60000 });
}

export function useActivityComments() {
    return useQuery({ queryKey: activityKeys.comments(), queryFn: () => api.get(`${A}/comments`).then(r => r.data), staleTime: 60000 });
}

export function useActivityStories() {
    return useQuery({ queryKey: activityKeys.stories(), queryFn: () => api.get(`${A}/stories`).then(r => r.data), staleTime: 60000 });
}

export function useActivityInteractions(type = '') {
    return useQuery({ queryKey: activityKeys.interactions(type), queryFn: () => api.get(`${A}/interactions${type ? `?type=${type}` : ''}`).then(r => r.data), staleTime: 60000 });
}

export function useActivityMuted() {
    const qc = useQueryClient();
    const query = useQuery({ queryKey: activityKeys.muted(), queryFn: () => api.get(`${A}/muted`).then(r => r.data), staleTime: 60000 });
    const unmute = useMutation({
        mutationFn: (id) => api.delete(`${A}/muted/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.muted() })
    });
    return { ...query, unmute };
}

export function useActivityNotInterested() {
    const qc = useQueryClient();
    const query = useQuery({ queryKey: activityKeys.notInterested(), queryFn: () => api.get(`${A}/not-interested`).then(r => r.data), staleTime: 60000 });
    const undo = useMutation({
        mutationFn: (id) => api.delete(`${A}/not-interested/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.notInterested() })
    });
    return { ...query, undo };
}

export function useActivityInterested() {
    const qc = useQueryClient();
    const query = useQuery({ queryKey: activityKeys.interested(), queryFn: () => api.get(`${A}/interested`).then(r => r.data), staleTime: 60000 });
    const undo = useMutation({
        mutationFn: (id) => api.delete(`${A}/interested/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.interested() })
    });
    return { ...query, undo };
}

export function useActivityTimeSpent() {
    return useQuery({ queryKey: activityKeys.timeSpent(), queryFn: () => api.get(`${A}/time-spent`).then(r => r.data), staleTime: 300000 });
}

export function useActivityAccount() {
    const qc = useQueryClient();
    const query = useQuery({ queryKey: activityKeys.account(), queryFn: () => api.get(`${A}/account`).then(r => r.data), staleTime: 60000 });
    const unblock = useMutation({
        mutationFn: (id) => api.delete(`${A}/blocked/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.account() })
    });
    return { ...query, unblock };
}
