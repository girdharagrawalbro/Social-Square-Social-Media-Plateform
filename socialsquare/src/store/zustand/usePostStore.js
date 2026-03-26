import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// UI-only state — server data comes from TanStack Query hooks
const usePostStore = create(
    devtools(
        (set, get) => ({
            // ─── Optimistic like state ─────────────────────────────────────
            // postId → Set of userIds who liked (merges with server data)
            optimisticLikes: {},

            // ─── Saved post IDs (for bookmark icon) ───────────────────────
            savedPostIds: new Set(),

            // ─── Post Detail Dialog ───────────────────────────────────────
            postDetailId: null,
            storyDetailUserId: null,

            // ─── Setters ──────────────────────────────────────────────────
            setActiveMood: (mood) => set({ activeMood: mood }),
            setPostDetailId: (id) => set({ postDetailId: id }),
            setStoryDetailUserId: (userId) => set({ storyDetailUserId: userId }),
            clearMood: () => set({ activeMood: null }),
            setOpenComment: (postId) => set({ openCommentPostId: postId }),
            closeComment: () => set({ openCommentPostId: null }),

            // ─── Optimistic like toggle ────────────────────────────────────
            optimisticLike: (postId, userId) => {
                set(state => {
                    const current = new Set(state.optimisticLikes[postId] || []);
                    if (current.has(userId)) current.delete(userId);
                    else current.add(userId);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            rollbackLike: (postId, userId, wasLiked) => {
                set(state => {
                    const current = new Set(state.optimisticLikes[postId] || []);
                    if (wasLiked) current.add(userId);
                    else current.delete(userId);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            // ─── Saved posts ───────────────────────────────────────────────
            initSavedIds: (ids) => set({ savedPostIds: new Set(ids) }),
            toggleSaved: (postId, saved) => {
                set(state => {
                    const next = new Set(state.savedPostIds);
                    if (saved) next.add(postId); else next.delete(postId);
                    return { savedPostIds: next };
                });
            },
            isSaved: (postId) => get().savedPostIds.has(postId),

            // ─── Socket real-time ──────────────────────────────────────────
            addSocketPost: (post) => {
                if (post.isAnonymous) {
                    set(state => {
                        const exists = state.socketConfessions.some(p => p._id === post._id);
                        return exists ? {} : { socketConfessions: [post, ...state.socketConfessions] };
                    });
                } else {
                    set(state => {
                        const exists = state.socketPosts.some(p => p._id === post._id);
                        return exists ? {} : { socketPosts: [post, ...state.socketPosts] };
                    });
                }
            },

            removeSocketPost: (postId) => {
                set(state => ({
                    socketPosts: state.socketPosts.filter(p => p._id !== postId),
                    socketConfessions: state.socketConfessions.filter(p => p._id !== postId),
                }));
            },

            syncLikeFromSocket: (postId, userId, liked) => {
                set(state => {
                    const current = new Set(state.optimisticLikes[postId] || []);
                    if (liked) current.add(userId); else current.delete(userId);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            clearSocketPosts: () => set({ socketPosts: [] }),
        }),
        { name: 'PostStore' }
    )
);

export default usePostStore;