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
            profileDetailId: null,
            storyDetailUserId: null,
            storyDetailStoryId: null,
            liveStreamId: null,
            isLiveHost: false,
            isStoryViewerOpen: false,
            chatbotOpen: false,

            // ─── Socket Data ─────────────────────────────────────────────
            socketPosts: [],
            socketConfessions: [],

            // ─── Setters ──────────────────────────────────────────────────
            setActiveMood: (mood) => set({ activeMood: mood }),
            setPostDetailId: (id) => set({ postDetailId: id }),
            setProfileDetailId: (id) => set({ profileDetailId: id }),
            setStoryDetailUserId: (userId) => set({ storyDetailUserId: userId }),
            setStoryDetailDeepLink: (userId, storyId = null) => set({ storyDetailUserId: userId, storyDetailStoryId: storyId }),
            setLiveStream: (id, isHost) => set({ liveStreamId: id, isLiveHost: isHost }),
            clearLiveStream: () => set({ liveStreamId: null, isLiveHost: false }),
            clearMood: () => set({ activeMood: null }),
            setOpenComment: (postId) => set({ openCommentPostId: postId }),
            closeComment: () => set({ openCommentPostId: null }),
            setSharingPostToStory: (post) => set({ sharingPostToStory: post }),
            clearSharingPostToStory: () => set({ sharingPostToStory: null }),
            setIsStoryViewerOpen: (isOpen) => set({ isStoryViewerOpen: isOpen }),
            setChatbotOpen: (isOpen) => set({ chatbotOpen: isOpen }),

            // ─── Optimistic like toggle ────────────────────────────────────
            optimisticLike: (postId, userId, initialLikes = []) => {
                const uid = userId?.toString();
                set(state => {
                    const existing = state.optimisticLikes[postId] || initialLikes;
                    // Convert Set to Array if needed, then map to strings
                    const likesList = existing instanceof Set ? Array.from(existing) : existing;
                    const current = new Set(
                        (likesList || []).map(id => id?.toString())
                    );
                    if (current.has(uid)) current.delete(uid);
                    else current.add(uid);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            rollbackLike: (postId, userId, wasLiked) => {
                const uid = userId?.toString();
                set(state => {
                    const existing = state.optimisticLikes[postId] || [];
                    // Convert Set to Array if needed, then map to strings
                    const likesList = existing instanceof Set ? Array.from(existing) : existing;
                    const current = new Set(
                        (likesList || []).map(id => id?.toString())
                    );
                    if (wasLiked) current.add(uid);
                    else current.delete(uid);
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

            // ─── Story View State ─────────────────────────────────────────
            viewedStoryGroups: new Set(),
            markGroupAsViewed: (userId) => {
                set(state => {
                    const next = new Set(state.viewedStoryGroups);
                    next.add(userId?.toString());
                    return { viewedStoryGroups: next };
                });
            },
            resetViewedGroups: () => set({ viewedStoryGroups: new Set() }),

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
