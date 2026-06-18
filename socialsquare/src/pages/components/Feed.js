import React, {
    useEffect, useRef, useState, useMemo, useCallback
} from "react";
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import SkeletonPost from './ui/SkeletonPost';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import ReportDialog from './ui/ReportDialog';
import toast from 'react-hot-toast';
import UserProfile from './UserProfile';
import FollowFollowingList from './FollowFollowingList';
import { useDarkMode } from '../../context/DarkModeContext';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import {
    useFeed, useMoodFeed,
    useLikePost, useSavePost, useDeletePost, useUpdatePost,
    useRecommendedPosts, useReactPost
} from '../../hooks/queries/usePostQueries';
import { useReportPost } from '../../hooks/queries/usePostOperationsQueries';
import usePostStore from '../../store/zustand/usePostStore';
import SharePostDialog from './ui/SharePostDialog';
import {
    useFollowUser, useMuteUser, useUnmuteUser,
    useBlockUser, useUnblockUser
} from '../../hooks/queries/useAuthQueries';
import { PostItem } from "./ui/PostItem";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Stable unique-by-_id map preserving insertion order */
const dedupeById = (posts) =>
    Array.from(new Map(posts.map(p => [p._id, p])).values());

/** Score a post for recommendation ranking (higher = better) */
const scorePost = (post, user, now = Date.now()) => {
    let score = 0;

    // Recency: decay over 48 h (posts older than 48 h score 0 here)
    const ageMs = now - new Date(post.createdAt || 0).getTime();
    const agePenalty = Math.max(0, 1 - ageMs / (48 * 3600 * 1000));
    score += agePenalty * 40;

    // Engagement signals
    const likes = post.likes?.length || 0;
    const comments = post.commentsCount || 0;
    score += Math.log1p(likes) * 5;
    score += Math.log1p(comments) * 8;

    // Mood match bonus
    if (post.isMoodMatch) score += 20;

    // Recommended by server bonus
    if (post.isRecommended) score += 15;

    // From a followed user bonus
    const postUserId = post.user?._id?.toString();
    if (postUserId && user?.following?.some(f => f?.toString() === postUserId)) {
        score += 25;
    }

    // Tie-break: small stable random jitter (set once per post)
    score += (post._jitter || 0) * 10;

    return score;
};

/** Limit consecutive posts from the same user (boundary healing) */
const limitConsecutive = (posts, maxConsecutive = 2) => {
    const getUid = (post) =>
        post.isAnonymous
            ? `anon_${post._id}`
            : (post.user?._id || post.user || '').toString();

    const result = [];
    const remaining = [...posts];
    let lastUid = null;
    let streak = 0;

    while (remaining.length > 0) {
        let idx = -1;
        for (let i = 0; i < remaining.length; i++) {
            const p = remaining[i];
            const uid = getUid(p);
            if (uid !== lastUid || streak < maxConsecutive) {
                idx = i;
                break;
            }
        }

        if (idx === -1) {
            // Can't interleave further — append rest to avoid dropping content
            result.push(...remaining);
            break;
        }

        const [post] = remaining.splice(idx, 1);
        const uid = getUid(post);
        streak = uid === lastUid ? streak + 1 : 1;
        lastUid = uid;
        result.push(post);
    }

    return result;
};


// ─── CUSTOM HOOK: recommendation assembly ─────────────────────────────────────

const useDisplayPosts = ({
    serverPosts,
    recommendedPosts,
    moodPosts,
    socketPosts,
    activeMood,
    user,
}) => {
    // Stable per-post jitter — never changes between renders
    const jitterMap = useRef({});

    return useMemo(() => {
        const now = Date.now();

        // 1. Choose base corpus
        let base;
        if (activeMood) {
            base = [...moodPosts];
        } else {
            // BUG FIX: was `recommendedPosts` (object, not spread) in original
            base = [...serverPosts, ...recommendedPosts, ...moodPosts];
        }

        // 2. Deduplicate base
        const uniqueBase = dedupeById(base);

        // 3. Assign stable jitter once per post
        uniqueBase.forEach(p => {
            if (jitterMap.current[p._id] === undefined) {
                jitterMap.current[p._id] = Math.random();
            }
            p._jitter = jitterMap.current[p._id];
        });

        // 4. Score & sort base posts (best first)
        const scoredBase = uniqueBase
            .map(p => ({ post: p, score: scorePost(p, user, now) }))
            .sort((a, b) => b.score - a.score)
            .map(({ post }) => post);

        // 5. Socket posts (newest real-time content) always go first
        const socketNew = socketPosts.filter(
            sp => !new Map(scoredBase.map(p => [p._id, true])).has(sp._id)
        );

        // 6. Merge
        const merged = [...socketNew, ...scoredBase];

        // 7. Enforce max-consecutive-same-user rule
        return limitConsecutive(merged, 2);
    }, [serverPosts, recommendedPosts, moodPosts, socketPosts, activeMood, user]);
};


// ─── CAPTION RENDERER ─────────────────────────────────────────────────────────

const CAPTION_THRESHOLD = 80;

const useCaption = (onProfileClick) => {
    const [expandedIds, setExpandedIds] = useState(new Set());

    const toggle = useCallback((postId) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(postId) ? next.delete(postId) : next.add(postId);
            return next;
        });
    }, []);

    const render = useCallback((caption = '', postId) => {
        const safe = caption || '';
        const isExpanded = expandedIds.has(postId);
        const truncated = safe.length > CAPTION_THRESHOLD && !isExpanded;
        const text = truncated ? safe.slice(0, CAPTION_THRESHOLD) + '…' : safe;

        const parts = text.split(/(\s+)/).map((token, i) => {
            if (/^#[\w]+$/.test(token)) {
                return <span key={i} className="text-indigo-500 font-medium">{token}</span>;
            }
            if (/^@[\w.]+$/.test(token)) {
                const username = token.slice(1).replace(/[^a-zA-Z0-9_.]/g, '');
                return (
                    <span 
                        key={i} 
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                const res = await api.get(`/api/auth/public/profile/${username}`);
                                if (res.data?._id && onProfileClick) {
                                    onProfileClick(res.data._id);
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        }}
                        className="text-[#808bf5] font-bold cursor-pointer hover:underline"
                    >
                        {token}
                    </span>
                );
            }
            return <span key={i}>{token}</span>;
        });

        return (
            <span className="text-sm">
                {parts}
                {safe.length > CAPTION_THRESHOLD && (
                    <button
                        onClick={(e) => { e.stopPropagation(); toggle(postId); }}
                        className="ml-1 border-0 bg-transparent p-0 text-[var(--text-sub)] font-bold text-xs cursor-pointer hover:text-[#808bf5] transition-colors"
                    >
                        {isExpanded ? ' show less' : ' more'}
                    </button>
                )}
            </span>
        );
    }, [expandedIds, toggle, onProfileClick]);

    return render;
};


// ─── ACTIVITY TRACKER ─────────────────────────────────────────────────────────

const useActivityTracker = () => {
    const queue = useRef([]);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        const flush = async () => {
            if (!isMounted.current || queue.current.length === 0) return;
            const batch = queue.current.splice(0);
            try {
                await api.post('/api/recommendation/batch-activity', { activities: batch });
            } catch {
                // Fire-and-forget — don't retry to avoid flooding
            }
        };

        const id = setInterval(flush, 10_000);
        window.addEventListener('beforeunload', flush);

        return () => {
            isMounted.current = false;
            clearInterval(id);
            window.removeEventListener('beforeunload', flush);
            flush(); // Final flush on unmount
        };
    }, []);

    const track = useCallback((postId, action, extra = {}) => {
        queue.current.push({ postId, action, timestamp: Date.now() / 1000, ...extra });
    }, []);

    return track;
};


// ─── FEED ─────────────────────────────────────────────────────────────────────

const Feed = ({ activeMood = null }) => {
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const { isDark } = useDarkMode();

    const rawSocketPosts = usePostStore(s => s.socketPosts);
    const socketPosts = useMemo(() => rawSocketPosts || [], [rawSocketPosts]);
    const isSaved = usePostStore(s => s.isSaved);
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);
    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);

    // ── Queries ──────────────────────────────────────────────────────────────
    const feedQuery = useFeed(user?._id);
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = feedQuery;
    const recommendedQuery = useRecommendedPosts(user?._id);
    const moodQuery = useMoodFeed(activeMood || user?.preferredMood || '', user?._id);

    // ── Mutations ────────────────────────────────────────────────────────────
    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const reactMutation = useReactPost();
    const reportMutation = useReportPost();
    const followMutation = useFollowUser();
    const muteMutation = useMuteUser();
    const unmuteMutation = useUnmuteUser();
    const blockMutation = useBlockUser();
    const unblockMutation = useUnblockUser();

    // ── UI State ─────────────────────────────────────────────────────────────
    const [pickerPostId, setPickerPostId] = useState(null);
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [sharePost, setSharePost] = useState(null);
    const [savingPostIds, setSavingPostIds] = useState(new Set());
    const [reportPost, setReportPost] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [likesVisible, setLikesVisible] = useState(false);
    const [likesIds, setLikesIds] = useState([]);
    const lastTap = useRef({});

    // ── Derived post lists ───────────────────────────────────────────────────
    const serverPosts = useMemo(
        () => feedQuery.data?.pages?.flatMap(p => p.posts) ?? [],
        [feedQuery.data]
    );
    const recommendedPosts = useMemo(
        () => (recommendedQuery.data ?? []).map(p => ({ ...p, isRecommended: true })),
        [recommendedQuery.data]
    );
    const moodPosts = useMemo(
        () => (moodQuery.data ?? []).map(p => ({ ...p, isMoodMatch: true })),
        [moodQuery.data]
    );

    const displayPosts = useDisplayPosts({
        serverPosts,
        recommendedPosts,
        moodPosts,
        socketPosts,
        activeMood,
        user,
    });

    // ── Infinite scroll ──────────────────────────────────────────────────────
    const { ref: loaderRef, inView } = useInView({ threshold: 0.1 });

    useEffect(() => {
        if (inView && !activeMood && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inView, activeMood, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Leave refetch behavior to react-query (disabled on-window-focus to avoid frequent calls)

    // ── Activity tracking ────────────────────────────────────────────────────
    const track = useActivityTracker();

    const handleDwell = useCallback((postId, dwellTime) => {
        if (dwellTime < 1000) return;
        track(postId, 'dwell', { duration: dwellTime });
    }, [track]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleReact = useCallback((post, emoji) => {
        if (navigator.vibrate) navigator.vibrate(15);
        reactMutation.mutate({ postId: post._id, emoji });
        setPickerPostId(null);
    }, [reactMutation]);

    const handleFollow = useCallback((targetUserId) => {
        if (targetUserId) followMutation.mutate({ targetUserId });
    }, [followMutation]);

    const handleLikeToggle = useCallback((post) => {
        if (likeMutation.isPending) return;
        if (navigator.vibrate) navigator.vibrate(10);

        const loggedUserId = user?._id?.toString();
        const optimisticSet = optimisticLikes[post._id];
        const liked = optimisticSet
            ? Array.from(optimisticSet).some(id => id?.toString() === loggedUserId)
            : (post.likes ?? []).some(id => id?.toString() === loggedUserId);

        likeMutation.mutate({ postId: post._id, isLiked: liked, likes: post.likes ?? [] });
        track(post._id, liked ? 'unlike' : 'like');
    }, [likeMutation, optimisticLikes, user?._id, track]);

    const handleImageDoubleClick = useCallback((post) => {
        const optimisticSet = optimisticLikes[post._id];
        const liked = optimisticSet
            ? optimisticSet.has(user?._id)
            : post.likes?.includes(user?._id);

        if (!liked) {
            if (navigator.vibrate) navigator.vibrate([10, 30]);
            likeMutation.mutate({ postId: post._id, isLiked: false, likes: post.likes ?? [] });
            track(post._id, 'like');
        }

        setHeartVisible(p => ({ ...p, [post._id]: true }));
        setTimeout(() => setHeartVisible(p => ({ ...p, [post._id]: false })), 800);
    }, [likeMutation, optimisticLikes, user?._id, track]);

    const handleImageTap = useCallback((post) => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] ?? 0) < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    }, [handleImageDoubleClick]);

    const handleSave = useCallback((post) => {
        setSavingPostIds(prev => new Set([...prev, post._id]));
        const wasSaved = isSaved(post._id);
        toggleSaved(post._id, !wasSaved);
        saveMutation.mutate({ postId: post._id }, {
            onError: () => {
                toggleSaved(post._id, wasSaved);
                toast.error('Failed to save');
            },
            onSettled: () => {
                setSavingPostIds(prev => {
                    const next = new Set(prev);
                    next.delete(post._id);
                    return next;
                });
            },
        });
        track(post._id, wasSaved ? 'unsave' : 'save');
    }, [isSaved, toggleSaved, saveMutation, track]);

    const handleDelete = useCallback((post) => {
        confirmDialog({
            message: 'Are you sure you want to delete this post?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                deleteMutation.mutate({ postId: post._id }, {
                    onSuccess: () => toast.success('Post deleted'),
                });
            },
        });
    }, [deleteMutation]);

    const handleEditSubmit = useCallback(() => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: editingPost._id, caption: editCaption }, {
            onSuccess: () => { toast.success('Updated'); setEditingPost(null); },
        });
    }, [editCaption, editingPost, updateMutation]);

    const handleReport = useCallback((post) => setReportPost(post), []);

    const handleProfileClick = useCallback((userId) => {
        setSelectedProfileId(userId);
        setProfileVisible(true);
    }, []);

    const submitReport = useCallback(async (reason) => {
        try {
            await reportMutation.mutateAsync({ postId: reportPost._id, reason });
            toast.success('Report submitted. Thank you!');
            setReportPost(null);
        } catch (e) {
            toast.error(e.response?.data?.error ?? 'Failed to report');
        }
    }, [reportMutation, reportPost]);

    const handleMute = useCallback((p) => {
        const isMuted = user?.mutedUsers?.some(m => m?.toString() === p.user?._id?.toString());
        if (isMuted) {
            unmuteMutation.mutate({ targetUserId: p.user._id });
        } else {
            confirmDialog({
                message: `Mute ${p.user.fullname}? Their posts will be hidden from your feed.`,
                header: 'Mute User',
                icon: 'pi pi-volume-off',
                acceptLabel: 'Mute',
                acceptClassName: 'p-button-warning border-0 rounded-xl',
                rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                accept: () => muteMutation.mutate({ targetUserId: p.user._id }),
            });
        }
    }, [user?.mutedUsers, muteMutation, unmuteMutation]);

    const handleBlock = useCallback((p) => {
        const isBlocked = user?.blockedUsers?.some(b => b?.toString() === p.user?._id?.toString());
        if (isBlocked) {
            unblockMutation.mutate({ targetUserId: p.user._id });
        } else {
            confirmDialog({
                message: `Block ${p.user.fullname}? They won't see your profile or posts, and you won't see theirs.`,
                header: 'Block Confirmation',
                icon: 'pi pi-ban',
                acceptLabel: 'Block',
                acceptClassName: 'p-button-danger border-0 rounded-xl',
                rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                accept: () => blockMutation.mutate({ targetUserId: p.user._id }),
            });
        }
    }, [user?.blockedUsers, blockMutation, unblockMutation]);

    // ── Caption ──────────────────────────────────────────────────────────────
    const renderCaption = useCaption(handleProfileClick);

    // ── Loading guard ────────────────────────────────────────────────────────
    const isLoading = feedQuery.isLoading && displayPosts.length === 0;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                @keyframes heartBurst {
                    0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
                    30%  { opacity: 1; transform: translate(-50%,-50%) scale(1.3); }
                    100% { opacity: 0; transform: translate(-50%,-50%) scale(1.4); }
                }
                .music-tag { animation: musicPulse 2s ease-in-out infinite; }
                @keyframes musicPulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.6; }
                }
            `}</style>

            <div className={`feed-container max-w-md mx-auto ${isDark ? 'bg-[#121212] text-white' : 'bg-gray-50 text-gray-900'} min-h-screen pb-20`}>
                {isLoading ? (
                    <div className="mt-1 flex flex-col">
                        {[1, 2, 3].map(i => <SkeletonPost key={i} />)}
                    </div>
                ) : (
                    <div className="mt-1 flex flex-col">
                        {displayPosts.length > 0 ? (
                            displayPosts.map((post, index) => (
                                <PostItem
                                    key={post._id ?? index}
                                    post={post}
                                    user={user}
                                    isLikedByMe={
                                        optimisticLikes[post._id]
                                            ? Array.from(optimisticLikes[post._id]).some(id => id?.toString() === user?._id?.toString())
                                            : (post.likes ?? []).some(id => id?.toString() === user?._id?.toString())
                                    }
                                    likesCount={
                                        optimisticLikes[post._id]
                                            ? optimisticLikes[post._id].size
                                            : (post.likes?.length ?? 0)
                                    }
                                    isSavedByMe={isSaved(post._id)}
                                    isFollowing={user?.following?.some(f => f?.toString() === post.user?._id?.toString())}
                                    heartVisible={!!heartVisible[post._id]}
                                    visiblePostId={visiblePostId}
                                    pickerPostId={pickerPostId}
                                    savingPostIds={savingPostIds}
                                    onLikeToggle={handleLikeToggle}
                                    onImageDoubleClick={handleImageDoubleClick}
                                    onImageTap={handleImageTap}
                                    onSave={handleSave}
                                    onDelete={handleDelete}
                                    onReport={handleReport}
                                    onShareToStory={setSharingPostToStory}
                                    onProfileClick={handleProfileClick}
                                    onSharePost={setSharePost}
                                    onEdit={(p) => { setEditingPost(p); setEditCaption(p.caption); }}
                                    setVisibleCommentId={setVisiblePostId}
                                    setPickerPostId={setPickerPostId}
                                    handleDwell={handleDwell}
                                    handleReact={handleReact}
                                    renderCaption={renderCaption}
                                    onFollow={handleFollow}
                                    onLikesClick={(ids) => { setLikesIds(ids); setLikesVisible(true); }}
                                    onMute={handleMute}
                                    onBlock={handleBlock}
                                />
                            ))
                        ) : (
                            <EmptyFeed activeMood={activeMood} isDark={isDark} onExplore={() => navigate('/explore')} />
                        )}

                        {/* Infinite scroll sentinel */}
                        <div ref={loaderRef} className="h-10 flex items-center justify-center">
                            {feedQuery.isFetchingNextPage && (
                                <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                            )}
                            {!activeMood && !feedQuery.hasNextPage && displayPosts.length > 0 && (
                                <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Dialogs ── */}
                {sharePost && (
                    <SharePostDialog
                        visible={!!sharePost}
                        onHide={() => setSharePost(null)}
                        post={sharePost}
                        user={user}
                        onShareToStory={() => setSharingPostToStory(sharePost)}
                    />
                )}

                {reportPost && (
                    <ReportDialog
                        visible={!!reportPost}
                        onHide={() => setReportPost(null)}
                        onSubmit={submitReport}
                        loading={reportMutation.isPending}
                    />
                )}

                {/* Edit Post Dialog */}
                <Dialog
                    header={false}
                    visible={!!editingPost}
                    style={{ width: '95vw', maxWidth: '420px', borderRadius: '24px' }}
                    onHide={() => setEditingPost(null)}
                    closable={false}
                >
                    {editingPost && (
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="m-0 text-xl font-bold text-gray-900 font-outfit">Edit Post</h3>
                                <button
                                    onClick={() => setEditingPost(null)}
                                    className="bg-gray-100 border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-200"
                                >✕</button>
                            </div>
                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                                <img src={editingPost.user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                                <span className="font-semibold text-sm">{editingPost.user.fullname}</span>
                            </div>
                            <textarea
                                value={editCaption}
                                onChange={e => setEditCaption(e.target.value)}
                                rows={6}
                                placeholder="Write your new caption…"
                                className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:border-indigo-400 outline-none transition font-medium"
                            />
                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => setEditingPost(null)}
                                    className="flex-1 py-3 border-2 border-gray-100 rounded-2xl bg-white cursor-pointer text-sm font-bold text-gray-500 hover:bg-gray-50 transition"
                                >Cancel</button>
                                <button
                                    onClick={handleEditSubmit}
                                    disabled={updateMutation.isPending}
                                    className="flex-1 py-3 bg-[#808bf5] text-white border-0 rounded-2xl cursor-pointer text-sm font-bold shadow-lg shadow-indigo-200 hover:opacity-90 transition disabled:opacity-50"
                                >
                                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}
                </Dialog>

                {/* Profile Dialog */}
                <Dialog
                    header="Profile"
                    visible={profileVisible}
                    style={{ width: '95vw', maxWidth: '450px', maxHeight: '90vh' }}
                    onHide={() => setProfileVisible(false)}
                >
                    <UserProfile id={selectedProfileId} maxPosts={3} />
                </Dialog>

                {/* Likes Dialog */}
                <Dialog
                    header="Liked By"
                    visible={likesVisible}
                    style={{ width: '95vw', maxWidth: '450px' }}
                    onHide={() => setLikesVisible(false)}
                    contentClassName="custom-scrollbar"
                >
                    <FollowFollowingList ids={likesIds} />
                </Dialog>
            </div>
        </>
    );
};


// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

const EmptyFeed = React.memo(({ activeMood, isDark, onExplore }) => (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className={`relative w-24 h-24 mb-6 flex items-center justify-center rounded-3xl rotate-12 transition-transform hover:rotate-0 duration-500 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-50 border-gray-100'} border-2 shadow-xl`}>
            <span className="text-5xl animate-bounce">📬</span>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-4 border-white dark:border-black animate-pulse" />
        </div>
        <h3 className={`text-2xl font-bold mb-2 font-outfit ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {activeMood ? `No ${activeMood} vibes yet` : 'Your feed is waiting'}
        </h3>
        <p className="text-gray-500 max-w-[280px] text-sm leading-relaxed mb-3">
            {activeMood
                ? `Be the first to share a post with the ${activeMood} mood!`
                : "Follow more people or share your first moment to see what's happening around you."
            }
        </p>
        <button
            onClick={onExplore}
            className="px-6 py-2.5 rounded-2xl bg-[#808bf5] text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:scale-105 transition-all cursor-pointer border-0"
        >
            Explore Trends
        </button>
    </div>
));

EmptyFeed.displayName = 'EmptyFeed';

export default Feed;