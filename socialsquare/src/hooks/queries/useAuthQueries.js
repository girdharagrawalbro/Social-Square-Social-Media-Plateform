import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const authKeys = {
    users: ['users'],
    userDetails: (ids) => ['users', 'details', ids?.sort().join(',')],
    userProfile: (userId) => ['users', 'profile', userId],
    followers: (userId) => ['users', 'followers', userId],
    following: (userId) => ['users', 'following', userId],
    otherUsers: ['users', 'other-users'],
    storyFeed: (userId) => ['stories', 'feed', userId],
    collabInvites: (userId) => ['posts', 'collab-invites', userId],
};

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
            const res = await axios.get(`${BASE}/api/auth/other-users`);
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
            const res = await api.get(`/api/post/collaborate/invites`);
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
        mutationFn: ({ targetUserId }) =>
            api.post(`/api/auth/follow`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            followUser(targetUserId);
            qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
            qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
        },
    });
}

export function useUnfollowUser() {
    const qc = useQueryClient();
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ targetUserId }) =>
            api.post(`/api/auth/unfollow`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            unfollowUser(targetUserId);
            qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
            qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
        },
    });
}
