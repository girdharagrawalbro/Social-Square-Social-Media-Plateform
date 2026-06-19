import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const authKeys = {
    users: ['users'],
    userDetails: (ids) => ['users', 'details', ids?.sort().join(',')],
    ownProfile: ['user', 'me'],                      // Token-resolved — never stale across nav
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

// ─── OWN PROFILE (/me — Race-condition-free) ──────────────────────────────────
// Resolved entirely from the JWT. Should only be called when viewingOwnProfile.
export function useOwnProfile(enabled = true) {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useQuery({
        queryKey: authKeys.ownProfile,
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/me`);
            return res.data;
        },
        enabled: initialized && !!user && !!enabled,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── OTHER USER PROFILE (/other-user/view/:id) ────────────────────────────────
// Resolved from explicit userId param. Should only be called when NOT viewingOwnProfile.
export function useOtherUserProfile(userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.userProfile(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/other-user/view/${userId}`);
            return res.data;
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── PREFETCH HELPERS ─────────────────────────────────────────────────────────
export function usePrefetchUserProfile() {
    const qc = useQueryClient();
    return (userId) => {
        if (!userId) return;
        qc.prefetchQuery({
            queryKey: authKeys.userProfile(userId),
            queryFn: async () => {
                const res = await api.get(`${BASE}/api/auth/other-user/view/${userId}`);
                return res.data;
            },
            staleTime: 1000 * 60 * 5,
        });
    };
}

// ─── FETCH CREATOR ANALYTICS (PROTECTED) ──────────────────────────────────────
export function useCreatorAnalytics(userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.analytics(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/analytics/${userId}`);
            return res.data;
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

// ─── FETCH USER DETAILS BY IDS ─────────────────────────────────────────────────
export function useUserDetails(ids = []) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.userDetails(ids),
        queryFn: async () => {
            if (!ids?.length) return [];

            // Batch requests if more than 100 IDs
            const chunks = [];
            for (let i = 0; i < ids.length; i += 100) {
                chunks.push(ids.slice(i, i + 100));
            }

            const results = await Promise.all(
                chunks.map(async (chunk) => {
                    const res = await api.post(`${BASE}/api/auth/users/details`, { ids: chunk });
                    return res.data?.users || [];
                })
            );

            return results.flat();
        },
        enabled: initialized && !!ids?.length,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
}

// ─── FETCH OTHER USERS (Suggested Users Sidebar) ────────────────────────────────
export function useOtherUsers(limit = 8) {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useQuery({
        queryKey: [...authKeys.otherUsers, limit],
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/other-users?limit=${limit}`);
            return Array.isArray(res.data) ? res.data : [];
        },
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
        enabled: initialized && !!user,
    });
}

// ─── FETCH OTHER USERS INFINITE (Discover Page) ───────────────────────────────
export function useInfiniteOtherUsers(limit = 10) {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useInfiniteQuery({
        queryKey: [...authKeys.otherUsers, 'infinite', limit],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await api.get(`${BASE}/api/auth/other-users?page=${pageParam}&limit=${limit}`);
            return Array.isArray(res.data) ? res.data : [];
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < limit) return undefined;
            return allPages.length + 1;
        },
        initialPageParam: 1,
        staleTime: 1000 * 60 * 5,
        enabled: initialized && !!user,
    });
}

// ─── FETCH STORY FEED (PROTECTED) ─────────────────────────────────────────────
export function useStoryFeed(userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.storyFeed(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/story/feed`);
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── FETCH COLLAB INVITES (PROTECTED) ─────────────────────────────────────────
export function useCollabInvites(userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.collabInvites(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/collaborate/invites/${userId}`);
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60,
    });
}

// ─── FETCH USER PROFILE ────────────────────────────────────────────────────────
export function useUserProfile(userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.userProfile(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/user/${userId}`);
            return res.data;
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
}

export function usePublicUserProfile(userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: ['user', 'public-profile', userId],
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/public/profile/${userId}`);
            return res.data;
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── FETCH FOLLOWERS INFINITE ─────────────────────────────────────────────────
export function useInfiniteFollowers(userId, limit = 10, options = {}) {
    const initialized = useAuthStore(s => s.initialized);
    return useInfiniteQuery({
        queryKey: [...authKeys.followers(userId), 'infinite', limit],
        queryFn: async ({ pageParam = null }) => {
            const res = await api.get(`${BASE}/api/auth/followers/${userId}`, {
                params: { limit, cursor: pageParam }
            });
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        initialPageParam: null,
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5,
        ...options
    });
}

// ─── FETCH FOLLOWING INFINITE ─────────────────────────────────────────────────
export function useInfiniteFollowing(userId, limit = 10, options = {}) {
    const initialized = useAuthStore(s => s.initialized);
    return useInfiniteQuery({
        queryKey: [...authKeys.following(userId), 'infinite', limit],
        queryFn: async ({ pageParam = null }) => {
            const res = await api.get(`${BASE}/api/auth/following/${userId}`, {
                params: { limit, cursor: pageParam }
            });
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        initialPageParam: null,
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5,
        ...options
    });
}

// ─── FOLLOW/UNFOLLOW MUTATIONS ────────────────────────────────────────────────
export function useFollowUser() {
    const qc = useQueryClient();
    const followUser = useAuthStore(s => s.followUser);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: async ({ targetUserId }) => {
            const res = await api.post(`${BASE}/api/auth/follow`, { userId: user._id, followUserId: targetUserId });
            return res.data;
        },
        onSuccess: (data, { targetUserId }) => {
            if (!data.requested) {
                followUser(targetUserId);
                qc.invalidateQueries({ queryKey: authKeys.followers(user?._id) });
                qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
            }

            // Update user profile details cache immediately
            qc.setQueryData(authKeys.userProfile(targetUserId), (prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    isFollowing: !data.requested,
                    hasPendingRequest: data.requested,
                    followRequests: data.requested
                        ? [...(prev.followRequests || []).filter(r => (r?.userId || r)?.toString() !== user?._id?.toString()), user?._id]
                        : prev.followRequests
                };
            });

            // Update other users lists cache immediately
            qc.setQueriesData({ queryKey: ['users', 'other-users'] }, (old) => {
                if (!old) return old;
                const updateFn = (u) => {
                    if (u._id !== targetUserId) return u;
                    return {
                        ...u,
                        isFollowing: !data.requested,
                        isRequested: data.requested,
                        followRequests: data.requested
                            ? [...(u.followRequests || []).filter(r => r?.toString() !== user?._id?.toString()), user?._id]
                            : u.followRequests
                    };
                };
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map(page => Array.isArray(page) ? page.map(updateFn) : page)
                    };
                }
                if (Array.isArray(old)) {
                    return old.map(updateFn);
                }
                return old;
            });

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
            api.post(`${BASE}/api/auth/unfollow`, { userId: user._id, unfollowUserId: targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            // Update local Zustand store so button changes to "Follow" immediately
            unfollowUser(targetUserId);

            // Update user profile details cache immediately
            qc.setQueryData(authKeys.userProfile(targetUserId), (prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    isFollowing: false,
                    hasPendingRequest: false
                };
            });

            // Update other users lists cache immediately
            qc.setQueriesData({ queryKey: ['users', 'other-users'] }, (old) => {
                if (!old) return old;
                const updateFn = (u) => {
                    if (u._id !== targetUserId) return u;
                    return {
                        ...u,
                        isFollowing: false,
                        isRequested: false
                    };
                };
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map(page => Array.isArray(page) ? page.map(updateFn) : page)
                    };
                }
                if (Array.isArray(old)) {
                    return old.map(updateFn);
                }
                return old;
            });

            // Invalidate profile so follower count updates if profile is open
            qc.invalidateQueries({ queryKey: authKeys.userProfile(targetUserId) });
            // Invalidate current user's following list
            qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
            qc.invalidateQueries({ queryKey: authKeys.otherUsers });
        },
    });
}

export function useAcceptFollowRequest() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ requesterId }) =>
            api.post(`${BASE}/api/auth/follow-request/accept`, { userId: user?._id, requesterId }),
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
            api.post(`${BASE}/api/auth/follow-request/decline`, { userId: user?._id, requesterId }),
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

export function useCancelFollowRequest() {
    const qc = useQueryClient();
    const loggedUser = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: async ({ targetUserId }) =>
            api.post(`${BASE}/api/auth/follow-request/cancel`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            // Update user profile details cache immediately
            qc.setQueryData(authKeys.userProfile(targetUserId), (prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    hasPendingRequest: false,
                    followRequests: (prev.followRequests || []).filter(
                        (r) => (r?.userId || r)?.toString() !== loggedUser?._id?.toString()
                    ),
                };
            });

            // Update other users lists cache immediately
            qc.setQueriesData({ queryKey: ['users', 'other-users'] }, (old) => {
                if (!old) return old;
                const updateFn = (u) => {
                    if (u._id !== targetUserId) return u;
                    return {
                        ...u,
                        isRequested: false,
                        followRequests: (u.followRequests || []).filter(
                            (r) => r?.toString() !== loggedUser?._id?.toString()
                        ),
                    };
                };
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map(page => Array.isArray(page) ? page.map(updateFn) : page)
                    };
                }
                if (Array.isArray(old)) {
                    return old.map(updateFn);
                }
                return old;
            });

            qc.invalidateQueries({ queryKey: authKeys.userProfile(targetUserId) });
            qc.invalidateQueries({ queryKey: authKeys.otherUsers });
            // Invalidate the notifications list for the current user
            if (loggedUser?._id) {
                qc.invalidateQueries({ queryKey: ['notifications', loggedUser._id] });
            }
        },
    });
}

export function useRemoveFollower() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    const setUser = useAuthStore(s => s.setUser);

    return useMutation({
        mutationFn: ({ followerId }) =>
            api.post(`${BASE}/api/auth/remove-follower`, { userId: user._id, followerId }),
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

// ─── CLOSE FRIENDS MUTATION ───────────────────────────────────────────────────
export function useToggleCloseFriend() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    const setUser = useAuthStore(s => s.setUser);

    return useMutation({
        mutationFn: ({ targetUserId }) =>
            api.post(`${BASE}/api/auth/close-friends/${targetUserId}/toggle`),
        onSuccess: (data, { targetUserId }) => {
            if (user) {
                let newCloseFriends = user.closeFriends || [];
                if (data.data.isCloseFriend) {
                    newCloseFriends = [...newCloseFriends, targetUserId];
                } else {
                    newCloseFriends = newCloseFriends.filter(id => id?.toString() !== targetUserId?.toString());
                }
                setUser({ ...user, closeFriends: newCloseFriends });
            }
            qc.invalidateQueries({ queryKey: authKeys.following(user?._id) });
            qc.invalidateQueries({ queryKey: authKeys.userProfile(targetUserId) });
        },
    });
}

// ─── GROUPS & COMMUNITIES ───────────────────────────────────────────────────
export function useGroups() {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useQuery({
        queryKey: authKeys.groups,
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/group/all`);
            return res.data;
        },
        staleTime: 1000 * 60 * 5,
        enabled: initialized && !!user,
    });
}

export function useGroupDetail(groupId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: authKeys.groupDetail(groupId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/group/${groupId}`);
            return res.data;
        },
        enabled: initialized && !!groupId,
        staleTime: 1000 * 60 * 2,
    });
}

export function useCreateGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (groupData) => api.post(`${BASE}/api/group/create`, groupData),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: authKeys.groups });
        },
    });
}

export function useJoinGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId }) => api.post(`${BASE}/api/group/join/${groupId}`),
        onSuccess: (_, { groupId }) => {
            qc.invalidateQueries({ queryKey: authKeys.groups });
            qc.invalidateQueries({ queryKey: authKeys.groupDetail(groupId) });
        },
    });
}

export function useLeaveGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId }) => api.post(`${BASE}/api/group/leave/${groupId}`),
        onSuccess: (_, { groupId }) => {
            qc.invalidateQueries({ queryKey: authKeys.groups });
            qc.invalidateQueries({ queryKey: authKeys.groupDetail(groupId) });
        },
    });
}

// ─── MUTE / BLOCK MUTATIONS ──────────────────────────────────────────────────
export function useMuteUser() {
    const qc = useQueryClient();
    const addMutedUser = useAuthStore(s => s.addMutedUser);
    return useMutation({
        mutationFn: ({ targetUserId }) => api.post(`${BASE}/api/auth/mute`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            addMutedUser(targetUserId);
            qc.invalidateQueries({ queryKey: ['posts'] });
            qc.invalidateQueries({ queryKey: ['user'] });
        },
    });
}

export function useUnmuteUser() {
    const qc = useQueryClient();
    const removeMutedUser = useAuthStore(s => s.removeMutedUser);
    return useMutation({
        mutationFn: ({ targetUserId }) => api.post(`${BASE}/api/auth/unmute`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            removeMutedUser(targetUserId);
            qc.invalidateQueries({ queryKey: ['posts'] });
            qc.invalidateQueries({ queryKey: ['user'] });
        },
    });
}

export function useBlockUser() {
    const qc = useQueryClient();
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const addBlockedUser = useAuthStore(s => s.addBlockedUser);
    return useMutation({
        mutationFn: ({ targetUserId }) => api.post(`${BASE}/api/auth/block`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            unfollowUser(targetUserId);
            addBlockedUser(targetUserId);
            qc.invalidateQueries({ queryKey: ['posts'] });
            qc.invalidateQueries({ queryKey: ['user'] });
            qc.invalidateQueries({ queryKey: authKeys.otherUsers });
        },
    });
}

export function useUnblockUser() {
    const qc = useQueryClient();
    const removeBlockedUser = useAuthStore(s => s.removeBlockedUser);
    return useMutation({
        mutationFn: ({ targetUserId }) => api.post(`${BASE}/api/auth/unblock`, { targetUserId }),
        onSuccess: (_, { targetUserId }) => {
            removeBlockedUser(targetUserId);
            qc.invalidateQueries({ queryKey: ['user'] });
        },
    });
}
