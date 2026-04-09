import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const authKeys = {
    users: ['users'],
    userDetails: (ids) => ['users', 'details', ids?.sort().join(',')],
    userProfile: (userId) => ['user', 'profile', userId],
    followers: (userId) => ['users', 'followers', userId],
    following: (userId) => ['users', 'following', userId],
    otherUsers: ['users', 'other-users'],
    storyFeed: (userId) => ['stories', 'feed', userId],
    collabInvites: (userId) => ['posts', 'collab-invites', userId],
    analytics: (userId) => ['users', 'analytics', userId],
    groups: ['groups'],
    groupDetail: (groupId) => ['groups', groupId],
};

// ─── FETCH CREATOR ANALYTICS (PROTECTED) ──────────────────────────────────────
export function useCreatorAnalytics(userId) {
    return useQuery({
        queryKey: authKeys.analytics(userId),
        queryFn: async () => {
            const res = await api.get(`/api/auth/analytics/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

// ─── FETCH USER DETAILS BY IDS ─────────────────────────────────────────────────
export function useUserDetails(ids = []) {
    return useQuery({
        queryKey: authKeys.userDetails(ids),
        queryFn: async () => {
            if (!ids?.length) return [];
            const res = await axios.post(`${BASE}/api/auth/users/details`, { ids });
            return res.data?.users || [];
        },
        enabled: !!ids?.length,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
}

// ─── FETCH OTHER USERS (Suggested Users Sidebar) ────────────────────────────────
export function useOtherUsers() {
    return useQuery({
        queryKey: authKeys.otherUsers,
        queryFn: async () => {
            const res = await api.get(`/api/auth/other-users`);
            return Array.isArray(res.data) ? res.data : [];
        },
        staleTime: 1000 * 60 * 10, // 10 minutes - suggested users don't change often
        gcTime: 1000 * 60 * 30,
    });
}

// ─── FETCH STORY FEED (PROTECTED) ─────────────────────────────────────────────
export function useStoryFeed(userId) {
    return useQuery({
        queryKey: authKeys.storyFeed(userId),
        queryFn: async () => {
            const res = await api.get(`/api/story/feed`);
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── FETCH COLLAB INVITES (PROTECTED) ─────────────────────────────────────────
export function useCollabInvites(userId) {
    return useQuery({
        queryKey: authKeys.collabInvites(userId),
        queryFn: async () => {
            const res = await api.get(`/api/post/collaborate/invites/${userId}`);
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: !!userId,
        staleTime: 1000 * 60,
    });
}

// ─── FETCH USER PROFILE ────────────────────────────────────────────────────────
export function useUserProfile(userId) {
    return useQuery({
        queryKey: authKeys.userProfile(userId),
        queryFn: async () => {
            const res = await axios.get(`${BASE}/api/auth/user/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
}

// ─── FETCH FOLLOWERS ───────────────────────────────────────────────────────────
export function useFollowers(userId) {
    const { data: followerIds } = useQuery({
        queryKey: authKeys.followers(userId),
        queryFn: async () => {
            const res = await axios.get(`${BASE}/api/auth/followers/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });

    return useUserDetails(followerIds);
}

// ─── FETCH FOLLOWING ───────────────────────────────────────────────────────────
export function useFollowing(userId) {
    const { data: followingIds } = useQuery({
        queryKey: authKeys.following(userId),
        queryFn: async () => {
            const res = await axios.get(`${BASE}/api/auth/following/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });

    return useUserDetails(followingIds);
}

// ─── FOLLOW/UNFOLLOW MUTATIONS ────────────────────────────────────────────────
export function useFollowUser() {
    const qc = useQueryClient();
    const followUser = useAuthStore(s => s.followUser);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: async ({ targetUserId }) => {
            const res = await api.post(`/api/auth/follow`, { userId: user._id, followUserId: targetUserId });
            return res.data;
        },
        onSuccess: (data, { targetUserId }) => {
            if (!data.requested) {
                followUser(targetUserId);
                qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
                qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
            }
            qc.invalidateQueries({ queryKey: authKeys.userProfile(targetUserId) });
            qc.invalidateQueries({ queryKey: authKeys.otherUsers });
        },
    });
}

export function useUnfollowUser() {
    const qc = useQueryClient();
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ targetUserId }) =>
            api.post(`/api/auth/unfollow`, { userId: user._id, unfollowUserId: targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            unfollowUser(targetUserId);
            qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
            qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
            qc.invalidateQueries({ queryKey: authKeys.userProfile(targetUserId) });
            qc.invalidateQueries({ queryKey: authKeys.otherUsers });
        },
    });
}

export function useAcceptFollowRequest() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ requesterId }) =>
            api.post(`/api/auth/follow-request/accept`, { userId: user?._id, requesterId }),
        onMutate: async ({ requesterId }) => {
            await qc.cancelQueries({ queryKey: ['notifications', user?._id] });
            const previousNotifications = qc.getQueryData(['notifications', user?._id]);
            qc.setQueryData(['notifications', user?._id], (old) => 
                old ? old.filter(n => n.sender?.id !== requesterId) : []
            );
            return { previousNotifications };
        },
        onError: (err, newTodo, context) => {
            qc.setQueryData(['notifications', user?._id], context.previousNotifications);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['notifications', user?._id] });
            qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
        },
    });
}

export function useDeclineFollowRequest() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ requesterId }) =>
            api.post(`/api/auth/follow-request/decline`, { userId: user?._id, requesterId }),
        onMutate: async ({ requesterId }) => {
            await qc.cancelQueries({ queryKey: ['notifications', user?._id] });
            const previousNotifications = qc.getQueryData(['notifications', user?._id]);
            qc.setQueryData(['notifications', user?._id], (old) => 
                old ? old.filter(n => n.sender?.id !== requesterId) : []
            );
            return { previousNotifications };
        },
        onError: (err, newTodo, context) => {
            qc.setQueryData(['notifications', user?._id], context.previousNotifications);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['notifications', user?._id] });
        },
    });
}

export function useRemoveFollower() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    const setUser = useAuthStore(s => s.setUser);

    return useMutation({
        mutationFn: ({ followerId }) =>
            api.post(`/api/auth/remove-follower`, { userId: user._id, followerId }),
        onSuccess: (_, { followerId }) => {
            // Update local state is optional but good for immediate feedback
            if (user) {
                const newFollowers = (user.followers || []).filter(f => f?.toString() !== followerId?.toString());
                setUser({ ...user, followers: newFollowers });
            }
            qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
        },
    });
}

// ─── GROUPS & COMMUNITIES ───────────────────────────────────────────────────
export function useGroups() {
    return useQuery({
        queryKey: authKeys.groups,
        queryFn: async () => {
            const res = await api.get(`/api/group/all`);
            return res.data;
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useGroupDetail(groupId) {
    return useQuery({
        queryKey: authKeys.groupDetail(groupId),
        queryFn: async () => {
            const res = await api.get(`/api/group/${groupId}`);
            return res.data;
        },
        enabled: !!groupId,
        staleTime: 1000 * 60 * 2,
    });
}

export function useCreateGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (groupData) => api.post(`/api/group/create`, groupData),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: authKeys.groups });
        },
    });
}

export function useJoinGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId }) => api.post(`/api/group/join/${groupId}`),
        onSuccess: (_, { groupId }) => {
            qc.invalidateQueries({ queryKey: authKeys.groups });
            qc.invalidateQueries({ queryKey: authKeys.groupDetail(groupId) });
        },
    });
}

export function useLeaveGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId }) => api.post(`/api/group/leave/${groupId}`),
        onSuccess: (_, { groupId }) => {
            qc.invalidateQueries({ queryKey: authKeys.groups });
            qc.invalidateQueries({ queryKey: authKeys.groupDetail(groupId) });
        },
    });
}
