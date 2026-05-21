import React, { useEffect, useRef, useState, useMemo } from "react";
import { useInView } from 'react-intersection-observer';
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
    useReactPost
} from '../../hooks/queries/usePostQueries';
import { useReportPost } from '../../hooks/queries/usePostOperationsQueries';
import usePostStore from '../../store/zustand/usePostStore';
import SharePostDialog from './ui/SharePostDialog';
import { useFollowUser, useMuteUser, useUnmuteUser, useBlockUser, useUnblockUser } from '../../hooks/queries/useAuthQueries';
import { PostItem } from "./ui/PostItem";



// ─── FEED ─────────────────────────────────────────────────────────────────────
const Feed = ({ activeMood = null }) => {
    // ✅ Zustand
    const user = useAuthStore(s => s.user);
    const { isDark } = useDarkMode();
    // const followUser = useAuthStore(s => s.followUser);
    // const unfollowUser = useAuthStore(s => s.unfollowUser);
    const rawSocketPosts = usePostStore(s => s.socketPosts);
    const socketPosts = useMemo(() => rawSocketPosts || [], [rawSocketPosts]);
    const isSaved = usePostStore(s => s.isSaved);
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);

    // ✅ TanStack Query
    const feedQuery = useFeed(user?._id);
    const moodQuery = useMoodFeed(activeMood || user?.preferredMood || '', user?._id);
    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const reactMutation = useReactPost();
    const followMutation = useFollowUser();
    const muteMutation = useMuteUser();
    const unmuteMutation = useUnmuteUser();
    const blockMutation = useBlockUser();
    const unblockMutation = useUnblockUser();

    const [pickerPostId, setPickerPostId] = useState(null);
    const reportMutation = useReportPost();
    // const setPostDetailId = usePostStore(s => s.setPostDetailId);

    const [liveInjectedPosts] = useState({});
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [sharePost, setSharePost] = useState(null);
    const [savingPostIds, setSavingPostIds] = useState(new Set());
    const [reportPost, setReportPost] = useState(null);
    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [likesVisible, setLikesVisible] = useState(false);
    const [likesIds, setLikesIds] = useState([]);
    const lastTap = useRef({});

    const handleReact = (post, emoji) => {
        if (navigator.vibrate) navigator.vibrate(15);
        reactMutation.mutate({ postId: post._id, emoji });
        setPickerPostId(null);
    };

    const handleFollow = (targetUserId) => {
        if (!targetUserId) return;
        followMutation.mutate({ targetUserId });
    };

    // Infinite scroll sentinel
    const { ref: loaderRef, inView } = useInView({ threshold: 0.1 });
    useEffect(() => {
        if (inView && !activeMood && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
        }
    }, [inView, activeMood, feedQuery]);

    // Merge pages + socket posts
    const serverPosts = useMemo(() => feedQuery.data?.pages?.flatMap(p => p.posts) || [], [feedQuery.data?.pages]);
    const moodPosts = useMemo(() => (moodQuery.data || []).map(p => ({ ...p, isMoodMatch: true })), [moodQuery.data]);

    const displayPosts = useMemo(() => {
        let basePosts = [];

        if (activeMood) {
            basePosts = [...moodPosts];
        } else {
            basePosts = [...serverPosts];
        }

        // 1. Separate socket posts from the rest to keep them at the top
        const socketNew = socketPosts.filter(sp => !basePosts.some(p => p._id === sp._id));

        // 2. Deduplicate the base posts
        const uniqueBaseEntries = Array.from(new Map(basePosts.map(p => [p._id, p])).values());

        // 3. Prepend new socket posts (Instantly appear at top)
        let finalArray = [...socketNew, ...uniqueBaseEntries];

        // 4. Inject live recommendations
        let withInjections = [];
        let seen = new Set();
        finalArray.forEach(p => {
            if (seen.has(p._id)) return;
            seen.add(p._id);
            withInjections.push(p);

            if (liveInjectedPosts[p._id]) {
                liveInjectedPosts[p._id].forEach(ip => {
                    if (!seen.has(ip._id)) {
                        seen.add(ip._id);
                        withInjections.push({ ...ip, isLiveInjected: true });
                    }
                });
            }
        });

        // 5. Apply client-side boundary-healing consecutive user limiting
        const maxConsecutive = 2;
        const result = [];
        const remaining = [...withInjections];
        let lastUserId = null;
        let consecutiveCount = 0;

        const getPostUserId = (post) => {
            if (post.isAnonymous) {
                return `anon_${post._id ? post._id.toString() : Math.random()}`;
            }
            const uid = post.user?._id || post.user;
            return uid ? uid.toString() : '';
        };

        while (remaining.length > 0) {
            let foundIdx = -1;
            for (let i = 0; i < remaining.length; i++) {
                const p = remaining[i];
                const uid = getPostUserId(p);
                if (uid !== lastUserId || consecutiveCount < maxConsecutive) {
                    foundIdx = i;
                    break;
                }
            }

            if (foundIdx !== -1) {
                const post = remaining.splice(foundIdx, 1)[0];
                const uid = getPostUserId(post);
                if (uid === lastUserId) {
                    consecutiveCount++;
                } else {
                    lastUserId = uid;
                    consecutiveCount = 1;
                }
                result.push(post);
            } else {
                // If it's impossible to interleave any further, append the rest to avoid dropping content
                result.push(...remaining);
                break;
            }
        }

        return result;
    }, [serverPosts, moodPosts, socketPosts, liveInjectedPosts, activeMood]);



    const handleLikeToggle = async (post) => {
        if (likeMutation.isPending) return;

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);

        const loggedUserId = user?._id?.toString();
        const optimisticSet = optimisticLikes[post._id];

        const liked = optimisticSet
            ? Array.from(optimisticSet).some(id => id?.toString() === loggedUserId)
            : (post.likes || []).some(id => id?.toString() === loggedUserId);

        likeMutation.mutate({
            postId: post._id,
            isLiked: liked,
            likes: post.likes || []
        });
    };

    const handleImageDoubleClick = async post => {
        const optimisticSet = optimisticLikes[post._id];
        const liked = optimisticSet
            ? optimisticSet.has(user?._id)
            : post.likes?.includes(user?._id);

        if (!liked) {
            if (navigator.vibrate) navigator.vibrate([10, 30]);
            likeMutation.mutate({
                postId: post._id,
                isLiked: false,
                likes: post.likes || []
            });
        }
        setHeartVisible(p => ({ ...p, [post._id]: true }));
        setTimeout(() => setHeartVisible(p => ({ ...p, [post._id]: false })), 800);
    };

    const handleImageTap = post => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] || 0) < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    };

    const handleSave = post => {
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
    };

    const handleDelete = post => {
        confirmDialog({
            message: 'Are you sure you want to delete this post?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                deleteMutation.mutate({ postId: post._id }, {
                    onSuccess: () => toast.success('Post deleted'),
                });
            }
        });
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: editingPost._id, caption: editCaption }, {
            onSuccess: () => { toast.success('Updated'); setEditingPost(null); }
        });
    };

    const handleReport = (post) => {
        setReportPost(post);
    };

    const handleProfileClick = (userId) => {
        setSelectedProfileId(userId);
        setProfileVisible(true);
    };

    const submitReport = async (reason) => {
        try {
            await reportMutation.mutateAsync({ postId: reportPost._id, reason });
            toast.success('Report submitted. Thank you!');
            setReportPost(null);
        } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const [expandedCaptions, setExpandedCaptions] = useState(new Set());

    const toggleCaption = (postId) => {
        setExpandedCaptions(prev => {
            const next = new Set(prev);
            if (next.has(postId)) next.delete(postId);
            else next.add(postId);
            return next;
        });
    };

    const renderCaption = (caption = '', postId) => {
        const threshold = 80;
        const safeCaption = caption || '';

        if (safeCaption.length <= threshold) {
            return <span className="text-sm">{safeCaption}</span>;
        }

        const isExpanded = expandedCaptions.has(postId);
        const displayCaption = isExpanded ? safeCaption : safeCaption.substring(0, threshold) + '...';

        const parts = displayCaption.split(/(\s+)/).map((token, i) => {
            if (/^#[\w]+$/.test(token) || /^@[\w.]+$/.test(token))
                return <span key={i} className="text-indigo-500 font-medium">{token}</span>;
            return <span key={i}>{token}</span>;
        });

        return (
            <span className="text-sm">
                {parts}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleCaption(postId); }}
                    className="ml-1 border-0 bg-transparent p-0 text-[var(--text-sub)] font-bold text-xs cursor-pointer hover:text-[#808bf5] transition-colors"
                >
                    {isExpanded ? ' show less' : ' more'}
                </button>
            </span>
        );
    };

    const isLoading = feedQuery.isLoading && displayPosts.length === 0;

    const activityQueue = useRef([]);
    useEffect(() => {
        const flush = async () => {
            if (activityQueue.current.length === 0) return;
            const batch = [...activityQueue.current];
            activityQueue.current = [];
            try {
                await api.post('/api/recommendation/batch-activity', { activities: batch });
            } catch (e) {
                // If it fails, we don't want to retry endlessly to stay 'unobtrusive'
            }
        };
        const interval = setInterval(flush, 10000); // Flush every 10s
        window.addEventListener('beforeunload', flush);
        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', flush);
            flush();
        };
    }, []);

    const handleDwell = (postId, dwellTime) => {
        if (dwellTime < 1000) return; // Only track significant interest
        activityQueue.current.push({
            postId,
            action: 'dwell',
            duration: dwellTime,
            timestamp: Date.now() / 1000
        });
    };

    return (
        <>
            <style>{`
                @keyframes heartBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
                .music-tag{animation:musicPulse 2s ease-in-out infinite}
                @keyframes musicPulse{0%,100%{opacity:1}50%{opacity:0.6}}
            `}</style>

            <div className={`feed-container max-w-2xl mx-auto ${isDark ? 'bg-[#121212] text-white' : 'bg-gray-50 text-gray-900'} min-h-screen pb-20`}>
                {isLoading ? (
                    <div className="mt-1 flex flex-col">{[1, 2, 3].map(i => <SkeletonPost key={i} />)}</div>
                ) : (
                    <div className="mt-1 flex flex-col">
                        {displayPosts.length > 0 ? displayPosts.map((post, index) => (
                            <PostItem
                                key={post._id || index}
                                post={post}
                                user={user}
                                isLikedByMe={optimisticLikes[post._id]
                                    ? Array.from(optimisticLikes[post._id]).some(id => id?.toString() === user?._id?.toString())
                                    : (post.likes || []).some(id => id?.toString() === user?._id?.toString())
                                }
                                likesCount={optimisticLikes[post._id] ? optimisticLikes[post._id].size : (post.likes?.length || 0)}
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
                                onEdit={(p) => { setEditingPost(p); setEditCaption(p.caption) }}
                                setVisibleCommentId={setVisiblePostId}
                                setPickerPostId={setPickerPostId}
                                handleDwell={handleDwell}
                                handleReact={handleReact}
                                renderCaption={renderCaption}
                                onFollow={handleFollow}
                                onLikesClick={(ids) => { setLikesIds(ids); setLikesVisible(true); }}
                                onMute={(p) => {
                                    const isMuted = user?.mutedUsers?.some(m => m?.toString() === p.user?._id?.toString());
                                    if (isMuted) {
                                        unmuteMutation.mutate({ targetUserId: p.user._id });
                                    } else {
                                        confirmDialog({
                                            message: `Are you sure you want to mute ${p.user.fullname}? Their posts will be hidden from your feed.`,
                                            header: 'Mute User',
                                            icon: 'pi pi-volume-off',
                                            acceptLabel: 'Mute',
                                            acceptClassName: 'p-button-warning border-0 rounded-xl',
                                            rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                                            accept: () => muteMutation.mutate({ targetUserId: p.user._id }),
                                        });
                                    }
                                }}
                                onBlock={(p) => {
                                    const isBlocked = user?.blockedUsers?.some(b => b?.toString() === p.user?._id?.toString());
                                    if (isBlocked) {
                                        unblockMutation.mutate({ targetUserId: p.user._id });
                                    } else {
                                        confirmDialog({
                                            message: `Are you sure you want to block ${p.user.fullname}? They won't be able to see your profile or posts, and you won't see theirs.`,
                                            header: 'Block Confirmation',
                                            icon: 'pi pi-ban',
                                            acceptLabel: 'Block',
                                            acceptClassName: 'p-button-danger border-0 rounded-xl',
                                            rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                                            accept: () => blockMutation.mutate({ targetUserId: p.user._id }),
                                        });
                                    }
                                }}

                            />
                        )) : (
                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                <div className={`relative w-24 h-24 mb-6 flex items-center justify-center rounded-3xl rotate-12 transition-transform hover:rotate-0 duration-500 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-50 border-gray-100'} border-2 shadow-xl`}>
                                    <span className="text-5xl animate-bounce">📬</span>
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-4 border-white dark:border-black animate-pulse"></div>
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
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                        className="px-6 py-2.5 rounded-2xl bg-[#808bf5] text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:scale-105 transition-all cursor-pointer border-0"
                                    >
                                        Explore Trends
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sentinel */}
                        <div ref={loaderRef} className="h-10 flex items-center justify-center">
                            {feedQuery.isFetchingNextPage && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                            {!activeMood && !feedQuery.hasNextPage && displayPosts.length > 0 && <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>}
                        </div>
                    </div>
                )}

                {sharePost && <SharePostDialog
                    visible={!!sharePost}
                    onHide={() => setSharePost(null)}
                    post={sharePost}
                    user={user}
                    onShareToStory={() => setSharingPostToStory(sharePost)}
                />}

                {reportPost && <ReportDialog
                    visible={!!reportPost}
                    onHide={() => setReportPost(null)}
                    onSubmit={submitReport}
                    loading={reportMutation.isPending}
                />}

                <Dialog header={false} visible={!!editingPost} style={{ width: '95vw', maxWidth: '420px', borderRadius: '24px' }} onHide={() => setEditingPost(null)} closable={false}>
                    {editingPost && (
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="m-0 text-xl font-bold text-gray-900 font-outfit">Edit Post</h3>
                                <button onClick={() => setEditingPost(null)} className="bg-gray-100 border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-200">✕</button>
                            </div>
                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                                <img src={editingPost.user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                                <span className="font-semibold text-sm">{editingPost.user.fullname}</span>
                            </div>
                            <div className="relative">
                                <textarea
                                    value={editCaption}
                                    onChange={e => setEditCaption(e.target.value)}
                                    rows={6}
                                    placeholder="Write your new caption..."
                                    className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:border-indigo-400 outline-none transition font-medium"
                                />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setEditingPost(null)} className="flex-1 py-3 border-2 border-gray-100 rounded-2xl bg-white cursor-pointer text-sm font-bold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                                <button onClick={handleEditSubmit} disabled={updateMutation.isPending} className="flex-1 py-3 bg-[#808bf5] text-white border-0 rounded-2xl cursor-pointer text-sm font-bold shadow-lg shadow-indigo-200 hover:opacity-90 transition disabled:opacity-50">
                                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}
                </Dialog>

                <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }} onHide={() => setProfileVisible(false)}>
                    <UserProfile id={selectedProfileId} maxPosts={3} />
                </Dialog>

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

export default Feed;
