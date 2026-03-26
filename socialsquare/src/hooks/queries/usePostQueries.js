import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const postKeys = {
    all: ['posts'],
    feed: (userId) => ['posts', 'feed', userId],
    userPosts: (userId) => ['posts', 'user', userId],
    saved: (userId) => ['posts', 'saved', userId],
    detail: (postId) => ['posts', 'detail', postId],
    comments: (postId) => ['posts', 'comments', postId],
    mood: (mood, userId) => ['posts', 'mood', mood, userId],
    confessions: ['posts', 'confessions'],
    trending: ['posts', 'trending'],
    categories: ['posts', 'categories'],
};

// ─── FEED (infinite scroll) ───────────────────────────────────────────────────
export function useFeed(userId) {
    return useInfiniteQuery({
        queryKey: postKeys.feed(userId),
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '10' });
            if (pageParam) params.append('cursor', pageParam);
            if (userId) params.append('userId', userId);
            const res = await axios.get(`${BASE}/api/post/?${params}`);
            return res.data; // { posts, nextCursor, hasMore }
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 2, // 2 minutes
        enabled: !!userId,
    });
}

// ─── USER POSTS ───────────────────────────────────────────────────────────────
export function useUserPosts(userId) {
    return useInfiniteQuery({
        queryKey: postKeys.userPosts(userId),
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '12' });
            if (pageParam) params.append('cursor', pageParam);
            const res = await axios.get(`${BASE}/api/post/user/${userId}?${params}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── SAVED POSTS ──────────────────────────────────────────────────────────────
export function useSavedPosts(userId) {
    const initSavedIds = usePostStore(s => s.initSavedIds);
    return useQuery({
        queryKey: postKeys.saved(userId),
        queryFn: async () => {
            const res = await axios.get(`${BASE}/api/post/saved/${userId}`);
            initSavedIds(res.data.map(p => p._id));
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── POST DETAIL ──────────────────────────────────────────────────────────────
export function usePostDetail(postId) {
    return useQuery({
        queryKey: postKeys.detail(postId),
        queryFn: async () => {
            const res = await axios.get(`${BASE}/api/post/detail/${postId}`);
            return res.data;
        },
        enabled: !!postId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
export function useComments(postId) {
    return useQuery({
        queryKey: postKeys.comments(postId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/comments`, {
                params: { postId }
            });
            return res.data;
        },
        enabled: !!postId,
        staleTime: 1000 * 30,
    });
}

// ─── MOOD FEED ────────────────────────────────────────────────────────────────
export function useMoodFeed(mood, userId) {
    return useQuery({
        queryKey: postKeys.mood(mood, userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/ai/mood-feed`, {
                params: { mood }
            });
            return res.data.posts;
        },
        enabled: !!mood && !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── CONFESSIONS ─────────────────────────────────────────────────────────────
export function useConfessions() {
    return useInfiniteQuery({
        queryKey: postKeys.confessions,
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '10' });
            if (pageParam) params.append('cursor', pageParam);
            const res = await axios.get(`${BASE}/api/post/confessions?${params}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── TRENDING ─────────────────────────────────────────────────────────────────
export function useTrending() {
    return useQuery({
        queryKey: postKeys.trending,
        queryFn: async () => { const res = await axios.get(`${BASE}/api/post/trending`); return res.data; },
        staleTime: 1000 * 60 * 10, // trending changes slowly
    });
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export function useCategories() {
    return useQuery({
        queryKey: postKeys.categories,
        queryFn: async () => { const res = await axios.get(`${BASE}/api/post/categories`); return res.data; },
        staleTime: Infinity, // categories never change
    });
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export function useCreatePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: (data) => api.post(`${BASE}/api/post/create`, data),
        onSuccess: (res) => {
            // Prepend to feed cache immediately
            try {
                qc.setQueriesData({ queryKey: postKeys.feed(user?._id) }, (old) => {
                    if (!old?.pages) return old;
                    const newPost = res?.data;
                    if (!newPost) return old;
                    return {
                        ...old,
                        pages: [
                            {
                                posts: [newPost, ...(old.pages[0]?.posts ?? [])],
                                nextCursor: old.pages[0]?.nextCursor,
                                hasMore: old.pages[0]?.hasMore,
                            },
                            ...old.pages.slice(1),
                        ],
                    };
                });
            } catch (_) { /* ignore cache update errors */ }
            qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
        },
    });
}

export function useLikePost() {
    const optimisticLike = usePostStore(s => s.optimisticLike);
    const rollbackLike = usePostStore(s => s.rollbackLike);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId, isLiked }) =>
            api.post(`${BASE}/api/post/${isLiked ? 'unlike' : 'like'}`, { postId }),
        onMutate: ({ postId, isLiked }) => {
            optimisticLike(postId, user._id);
            return { postId, wasLiked: isLiked };
        },
        onError: (_, __, ctx) => {
            rollbackLike(ctx.postId, user._id, ctx.wasLiked);
        },
    });
}

export function useSavePost() {
    const qc = useQueryClient();
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId }) => api.post(`${BASE}/api/post/save`, { postId }),
        onSuccess: (res, { postId }) => {
            toggleSaved(postId, res.data.saved);
            qc.invalidateQueries({ queryKey: postKeys.saved(user?._id) });
        },
    });
}

export function useCreateComment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.post(`${BASE}/api/post/comments/add`, data),
        onSuccess: (_, { postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        },
    });
}

export function useDeleteComment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ commentId, postId }) =>
            api.delete(`${BASE}/api/post/comments/${commentId}`),
        onSuccess: (_, { postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        },
    });
}

export function useDeletePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ postId }) =>
            api.delete(`${BASE}/api/post/delete/${postId}`),
        onSuccess: (_, { postId }) => {
            // Remove from all feed caches
            qc.setQueriesData({ queryKey: postKeys.feed(user?._id) }, (old) => {
                if (!old) return old;
                return { ...old, pages: old.pages.map(page => ({ ...page, posts: page.posts.filter(p => p._id !== postId) })) };
            });
            qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
        },
    });
}

export function useUpdatePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ postId, caption, category }) =>
            api.put(`${BASE}/api/post/update/${postId}`, { caption, category }),
        onSuccess: (res) => {
            qc.setQueryData(postKeys.detail(res.data._id), res.data);
            qc.invalidateQueries({ queryKey: postKeys.feed(user?._id) });
        },
    });
}