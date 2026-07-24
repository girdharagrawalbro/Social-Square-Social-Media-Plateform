import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import { appChannel } from '../../utils/broadcast';
import dbService from '../../utils/indexedDb';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const postKeys = {
    all: ['posts'],
    feed: (userId, depth = null) => ['posts', 'feed', userId, depth],
    userPosts: (userId) => ['posts', 'user', userId],
    saved: (userId) => ['posts', 'saved', userId],
    detail: (postId) => ['posts', 'detail', postId],
    comments: (postId) => ['posts', 'comments', postId],
    mood: (mood, userId) => ['posts', 'mood', mood, userId],
    confessions: ['posts', 'confessions'],
    trending: ['posts', 'trending'],
    categories: ['posts', 'categories'],
    recommended: (userId) => ['posts', 'recommended', userId],
    similar: (postId) => ['posts', 'similar', postId],
    personalizedSearch: (userId, q) => ['posts', 'search', 'personalized', userId, q],
};

// ─── FEED (infinite scroll) ───────────────────────────────────────────────────
export function useFeed(userId, depth = null) {
    const initialized = useAuthStore(s => s.initialized);
    const queryClient = useQueryClient();
    return useInfiniteQuery({
        queryKey: postKeys.feed(userId, depth),
        queryFn: async ({ pageParam = null }) => {
            const cacheKey = `feed_${userId}_${depth || 'all'}`;
            
            const fetchPromise = (async () => {
                try {
                    const params = new URLSearchParams();
                    if (pageParam) params.append('cursor', pageParam);
                    if (depth) params.append('depth', depth);
                    const res = await api.get(`${BASE}/api/recommendation/posts?${params}`);
                    
                    const transformedData = {
                        posts: res.data.items || res.data.posts || [],
                        nextCursor: res.data.nextCursor || null,
                        hasMore: !!res.data.hasMore,
                        isColdStart: res.data.isColdStart || false,
                        isFallback: res.data.isFallback || false
                    };

                    if (!pageParam && transformedData) {
                        await dbService.setCache(cacheKey, transformedData);
                    }

                    return transformedData;
                } catch (err) {
                    console.warn('Recommendation feed failed, falling back to basic feed:', err.message);
                    const params = new URLSearchParams({ limit: '10' });
                    if (userId) params.append('userId', userId);
                    if (pageParam) params.append('cursor', pageParam);
                    if (depth) params.append('depth', depth);
                    const res = await api.get(`${BASE}/api/post/?${params}`);
                    if (!pageParam && res.data) {
                        await dbService.setCache(cacheKey, res.data);
                    }
                    return res.data;
                }
            })();

            if (!pageParam) {
                const cached = await dbService.getCache(cacheKey);
                if (cached) {
                    fetchPromise.then(freshData => {
                        queryClient.setQueryData(postKeys.feed(userId, depth), (old) => {
                            if (!old) return { pages: [freshData], pageParams: [null] };
                            return {
                                ...old,
                                pages: old.pages.map((page, idx) => idx === 0 ? freshData : page)
                            };
                        });
                    }).catch(err => console.error("Background feed fetch failed:", err));
                    return cached;
                }
            }

            return fetchPromise;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 5, 
        gcTime: 1000 * 60 * 5, 
        enabled: initialized && !!userId,
        refetchOnWindowFocus: false,
        refetchOnMount: 'stale', 
    });
}

// ─── USER POSTS ───────────────────────────────────────────────────────────────
export function useUserPosts(userId) {
    const initialized = useAuthStore(s => s.initialized);
    const queryClient = useQueryClient();
    return useInfiniteQuery({
        queryKey: postKeys.userPosts(userId),
        queryFn: async ({ pageParam = null }) => {
            const cacheKey = `user_posts_${userId}`;
            const params = new URLSearchParams();
            if (pageParam) params.append('cursor', pageParam);
            
            const fetchPromise = api.get(`${BASE}/api/post/user/${userId}?${params}`).then(async (res) => {
                if (!pageParam && res.data) {
                    await dbService.setCache(cacheKey, res.data);
                }
                return res.data;
            });

            if (!pageParam) {
                const cached = await dbService.getCache(cacheKey);
                if (cached) {
                    fetchPromise.then(freshData => {
                        queryClient.setQueryData(postKeys.userPosts(userId), (old) => {
                            if (!old) return { pages: [freshData], pageParams: [null] };
                            return {
                                ...old,
                                pages: old.pages.map((page, idx) => idx === 0 ? freshData : page)
                            };
                        });
                    }).catch(err => console.error("Background user posts fetch failed:", err));
                    return cached;
                }
            }

            return fetchPromise;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        enabled: !!userId && initialized,
        staleTime: 1000 * 60 * 5,
    });
}

export function usePublicUserPosts(userId) {
    return useQuery({
        queryKey: ['posts', 'public', userId],
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/public/user/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── SAVED POSTS ──────────────────────────────────────────────────────────────
export function useSavedPosts(userId) {
    const initialized = useAuthStore(s => s.initialized);
    const initSavedIds = usePostStore(s => s.initSavedIds);
    return useQuery({
        queryKey: postKeys.saved(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/saved/${userId}`);
            initSavedIds(res.data.map(p => p._id));
            return res.data;
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── POST DETAIL ──────────────────────────────────────────────────────────────
export function usePostDetail(postId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: postKeys.detail(postId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/detail/${postId}`);
            return res.data;
        },
        enabled: initialized && !!postId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
export function useComments(postId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: postKeys.comments(postId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/comments`, {
                params: { postId }
            });
            return res.data;
        },
        enabled: initialized && !!postId,
        staleTime: 1000 * 30,
    });
}

// ─── MOOD FEED ────────────────────────────────────────────────────────────────
export function useMoodFeed(mood, userId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: postKeys.mood(mood, userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/ai/mood-feed`, {
                params: { mood }
            });
            return res.data.posts;
        },
        enabled: initialized && !!mood && !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── CONFESSIONS ─────────────────────────────────────────────────────────────
export function useConfessions() {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useInfiniteQuery({
        queryKey: postKeys.confessions,
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '10' });
            if (pageParam) params.append('cursor', pageParam);
            const res = await api.get(`${BASE}/api/post/confessions?${params}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 2,
        enabled: initialized && !!user,
    });
}

// ─── TRENDING ─────────────────────────────────────────────────────────────────
export function useTrending() {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useQuery({
        queryKey: postKeys.trending,
        queryFn: async () => { const res = await api.get(`${BASE}/api/post/trending`); return res.data; },
        staleTime: 1000 * 60 * 10, // trending changes slowly
        enabled: initialized && !!user,
    });
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export function useCategories() {
    const initialized = useAuthStore(s => s.initialized);
    const user = useAuthStore(s => s.user);
    return useQuery({
        queryKey: postKeys.categories,
        queryFn: async () => { const res = await api.get(`${BASE}/api/post/categories`); return res.data; },
        staleTime: Infinity, // categories never change
        enabled: initialized && !!user,
    });
}

// ─── RECOMMENDATIONS ──────────────────────────────────────────────────────────
// FIX: useRecommendedPosts previously made a duplicate call to /api/recommendation/posts
// (the same endpoint as useFeed). We now derive data from the feed query cache to
// avoid a redundant network request and prevent duplicate posts in the feed assembler.
export function useRecommendedPosts(userId) {
    const initialized = useAuthStore(s => s.initialized);
    const qc = useQueryClient();
    return useQuery({
        queryKey: postKeys.recommended(userId),
        queryFn: async () => {
            // Try to pull from feed cache first (avoids duplicate network request)
            const feedData = qc.getQueryData(postKeys.feed(userId));
            if (feedData?.pages?.length) {
                return feedData.pages.flatMap(p => p.posts) ?? [];
            }
            // Fallback: fetch from recommendation endpoint only if feed cache is empty
            const res = await api.get(`${BASE}/api/recommendation/posts`);
            return res.data.items ?? [];
        },
        enabled: initialized && !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

export function useSimilarPosts(postId) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: postKeys.similar(postId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/recommendation/similar/${postId}`);
            return res.data.items;
        },
        enabled: initialized && !!postId,
        staleTime: 1000 * 60 * 10,
    });
}

export function usePersonalizedSearch(userId, q, typeFilter = 'all') {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: postKeys.personalizedSearch(userId, `${q}-${typeFilter}`),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/recommendation/search`, {
                params: { q, typeFilter }
            });
            return res.data.items;
        },
        enabled: initialized && !!userId && !!q,
        staleTime: 1000 * 60 * 2,
    });
}

export function useAiAnswer(q, itemIds) {
    const initialized = useAuthStore(s => s.initialized);
    return useQuery({
        queryKey: ['ai-answer', q, itemIds?.join(',')],
        queryFn: async () => {
            const res = await api.post(`${BASE}/api/recommendation/search/synthesize`, { q, itemIds });
            return res.data.answer;
        },
        enabled: initialized && !!q && Array.isArray(itemIds) && itemIds.length > 0,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export function usePrefetchPost() {
    const qc = useQueryClient();
    return (postId) => {
        if (!postId) return;
        qc.prefetchQuery({
            queryKey: postKeys.detail(postId),
            queryFn: async () => {
                const res = await api.get(`${BASE}/api/post/detail/${postId}`);
                return res.data;
            },
            staleTime: 1000 * 60 * 5,
        });
    };
}

export function useCreatePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: (data) => api.post(`${BASE}/api/post/create`, data),
        onSuccess: async (res) => {
            if (user?._id) {
                try {
                    await dbService.removeCache(`user_posts_${user._id}`);
                    await dbService.removeCache(`feed_${user._id}_all`);
                } catch (cacheErr) {
                    console.warn('Failed to clear post cache:', cacheErr);
                }
            }
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
            clearFeedIndexedDbCache(user?._id);
            qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
            qc.invalidateQueries({ queryKey: postKeys.feed(user?._id) });
        },
    });
}

export function useIncrementView() {
    return useMutation({
        mutationFn: ({ postId }) => api.post(`${BASE}/api/post/view/${postId}`),
    });
}

export function useVotePoll() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ postId, optionIndex }) =>
            api.post(`${BASE}/api/post/vote`, { postId, optionIndex }),
        onSuccess: (res, { postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
            qc.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    return key[0] === 'posts' && 
                           key[1] !== 'categories' && 
                           key[1] !== 'collab-invites';
                }
            });
        },
    });
}

export function useReactPost() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ postId, emoji }) =>
            api.post(`${BASE}/api/post/react`, { postId, emoji }),
        onMutate: async ({ postId, emoji }) => {
            await qc.cancelQueries({ queryKey: postKeys.detail(postId) });
            const prev = qc.getQueryData(postKeys.detail(postId));
            qc.setQueryData(postKeys.detail(postId), (old) => {
                if (!old) return old;
                // Simplified optimistic reaction update logic would go here
                return old;
            });
            return { prev };
        },
        onSuccess: (res, { postId }) => {
            qc.setQueryData(postKeys.detail(postId), res.data);
            qc.setQueriesData({ queryKey: ['posts'] }, (oldData) => {
                if (!oldData) return oldData;
                
                // Infinite query data (e.g. feed)
                if (oldData.pages) {
                    return {
                        ...oldData,
                        pages: oldData.pages.map(page => ({
                            ...page,
                            posts: (page.posts || page.items || []).map(p => 
                                p._id === postId ? { ...p, reactions: res.data.reactions, likes: res.data.likes } : p
                            )
                        }))
                    };
                }
                
                // Array of posts
                if (Array.isArray(oldData)) {
                    return oldData.map(p => p._id === postId ? { ...p, reactions: res.data.reactions, likes: res.data.likes } : p);
                }
                
                // Single post object
                if (oldData._id === postId) {
                    return { ...oldData, reactions: res.data.reactions, likes: res.data.likes };
                }
                
                return oldData;
            });
            qc.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    return key[0] === 'posts' && 
                           key[1] !== 'categories' && 
                           key[1] !== 'collab-invites';
                }
            });
        },
    });
}

export function useLikePost() {
    const qc = useQueryClient();
    const optimisticLike = usePostStore(s => s.optimisticLike);
    const rollbackLike = usePostStore(s => s.rollbackLike);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId, isLiked }) =>
            api.post(`${BASE}/api/post/${isLiked ? 'unlike' : 'like'}`, { postId }),
        onMutate: async ({ postId, isLiked, likes = [] }) => {
            // Cancel outgoing refetches for details to prevent overwrite
            await qc.cancelQueries({ queryKey: postKeys.detail(postId) });

            // Optimistically update zustand store (UI state)
            if (user?._id) optimisticLike(postId, user._id, likes);

            return { postId, wasLiked: isLiked };
        },
        onError: (err, { postId }, ctx) => {
            if (ctx?.postId && user?._id) rollbackLike(ctx.postId, user._id, ctx.wasLiked);
        },
        onSettled: (data, error, { postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
            qc.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    return key[0] === 'posts' && 
                           key[1] !== 'categories' && 
                           key[1] !== 'collab-invites';
                }
            });
        },
    });
}

export function useSavePost() {
    const qc = useQueryClient();
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId }) => api.post(`${BASE}/api/post/save`, { postId }),
        onMutate: async ({ postId }) => {
            // Optimistic toggle in Zustand
            toggleSaved(postId);
            return { postId };
        },
        onSuccess: (res, variables) => {
            if (variables?.postId) {
                // Ensure state matches server response
                toggleSaved(variables.postId, res.data.saved);
                qc.invalidateQueries({ queryKey: postKeys.saved(user?._id) });
                appChannel.postMessage({
                    type: "POST_SAVED_STATE",
                    postId: variables.postId,
                    saved: res.data.saved
                });
            }
        },
        onError: (err, variables) => {
            // Rollback on error
            if (variables?.postId) toggleSaved(variables.postId);
        }
    });
}

export function useLikeComment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ commentId }) =>
            api.post(`${BASE}/api/post/comments/${commentId}/like`),
        onSuccess: (_, variables) => {
            if (variables?.postId) {
                qc.invalidateQueries({ queryKey: postKeys.comments(variables.postId) });
            }
        },
    });
}

export function useCreateComment() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: (data) => api.post(`${BASE}/api/post/comments/add`, data),
        onMutate: async (newComment) => {
            if (!newComment.postId) return;

            // Cancel outgoing refetches for comments
            await qc.cancelQueries({ queryKey: postKeys.comments(newComment.postId) });

            // Snapshot previous value
            const previousComments = qc.getQueryData(postKeys.comments(newComment.postId));

            // Optimistically update to the new value
            qc.setQueryData(postKeys.comments(newComment.postId), (old = []) => [
                {
                    _id: 'temp-id-' + Date.now(),
                    content: newComment.content,
                    userId: user,
                    createdAt: new Date().toISOString(),
                    likes: [],
                    isOptimistic: true // marker for UI to show a "sending..." state
                },
                ...old
            ]);

            return { previousComments, postId: newComment.postId };
        },
        onError: (err, newComment, context) => {
            if (context?.postId) {
                qc.setQueryData(postKeys.comments(context.postId), context.previousComments);
            }
        },
        onSuccess: (res, variables) => {
            if (res.data?.commentsCount !== undefined) {
                appChannel.postMessage({
                    type: "COMMENT_COUNT_SYNC",
                    postId: variables.postId,
                    commentsCount: res.data.commentsCount
                });
            }
        },
        onSettled: (data, error, variables) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(variables.postId) });
            qc.invalidateQueries({ queryKey: postKeys.detail(variables.postId) });
            if (user?._id) {
                qc.invalidateQueries({ queryKey: postKeys.feed(user._id) });
                qc.invalidateQueries({ queryKey: postKeys.userPosts(user._id) });
                qc.invalidateQueries({ queryKey: postKeys.saved(user._id) });
            }
            qc.invalidateQueries({ queryKey: postKeys.confessions });
            qc.invalidateQueries({ queryKey: postKeys.trending });
            qc.invalidateQueries({ queryKey: postKeys.recommended(user?._id) });
        },
    });
}

export function useDeleteComment() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ commentId, postId }) =>
            api.delete(`${BASE}/api/post/comments/${commentId}`),
        onSuccess: (res, variables) => {
            if (variables?.postId) {
                const { postId } = variables;
                qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
                qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
                if (user?._id) {
                    qc.invalidateQueries({ queryKey: postKeys.feed(user._id) });
                    qc.invalidateQueries({ queryKey: postKeys.userPosts(user._id) });
                    qc.invalidateQueries({ queryKey: postKeys.saved(user._id) });
                }
                qc.invalidateQueries({ queryKey: postKeys.confessions });
                qc.invalidateQueries({ queryKey: postKeys.trending });
                qc.invalidateQueries({ queryKey: postKeys.recommended(user?._id) });

                if (res.data?.commentsCount !== undefined) {
                    appChannel.postMessage({
                        type: "COMMENT_COUNT_SYNC",
                        postId,
                        commentsCount: res.data.commentsCount
                    });
                }
            }
        },
    });
}

export function useMarkBestAnswer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ commentId }) => api.put(`${BASE}/api/post/comments/${commentId}/mark-best`),
        onSuccess: (_, variables) => {
            if (variables?.postId) {
                qc.invalidateQueries({ queryKey: postKeys.comments(variables.postId) });
            }
        }
    });
}

export function useMarkInsightful() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ commentId }) => api.put(`${BASE}/api/post/comments/${commentId}/mark-insightful`),
        onSuccess: (_, variables) => {
            if (variables?.postId) {
                qc.invalidateQueries({ queryKey: postKeys.comments(variables.postId) });
            }
        }
    });
}

async function clearFeedIndexedDbCache(userId) {
    if (!userId) return;
    try {
        await Promise.all([
            dbService.removeCache(`feed_${userId}_all`),
            dbService.removeCache(`feed_${userId}_quick_take`),
            dbService.removeCache(`feed_${userId}_deep_dive`),
            dbService.removeCache(`feed_${userId}_long_read`),
            dbService.removeCache(`feed_${userId}_null`),
            dbService.removeCache(`user_posts_${userId}`),
            dbService.removeCache('feed_posts'),
        ]);
    } catch (e) {
        console.warn('Failed to clear feed IndexedDB cache:', e.message);
    }
}

export function useDeletePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ postId }) =>
            api.delete(`${BASE}/api/post/delete/${postId}`),
        onSuccess: (_, variables) => {
            if (variables?.postId) {
                const { postId } = variables;
                clearFeedIndexedDbCache(user?._id);
                // Remove from all feed caches
                qc.setQueriesData({ queryKey: postKeys.feed(user?._id) }, (old) => {
                    if (!old) return old;
                    return { ...old, pages: old.pages.map(page => ({ ...page, posts: (page.posts || []).filter(p => p._id !== postId) })) };
                });
                qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
                qc.invalidateQueries({ queryKey: postKeys.feed(user?._id) });
            }
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
            clearFeedIndexedDbCache(user?._id);
            qc.setQueryData(postKeys.detail(res.data._id), res.data);
            qc.invalidateQueries({ queryKey: postKeys.feed(user?._id) });
            qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
        },
    });
}
