import { useState, useRef, useLayoutEffect } from 'react';
import { useConfessions } from '../../hooks/queries/useExploreQueries';
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import Groups from './Groups';
import SkeletonCommunities from './ui/SkeletonCommunities';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import ReportDialog from './ui/ReportDialog';
import { confirmDialog } from 'primereact/confirmdialog';
import toast from '../../utils/toast.js';
import { useQueryClient } from '@tanstack/react-query';
import { useLikePost, useSavePost, useReactPost } from '../../hooks/queries/usePostQueries';
import { useFollowUser } from '../../hooks/queries/useAuthQueries';
import SkeletonPost from './ui/SkeletonPost';
import { PostItem } from './ui/PostItem';
import usePostStore from '../../store/zustand/usePostStore';
import SharePostDialog from './ui/SharePostDialog';
import FollowFollowingList from './FollowFollowingList';

// ─── CONFESSIONS FEED ─────────────────────────────────────────────────────────
const ConfessionsFeed = ({ onProfileClick }) => {
    const [reportPost, setReportPost] = useState(null);

    const user = useAuthStore(s => s.user);
    const queryClient = useQueryClient();
    // ✅ TanStack Query for confessions - infinite scroll
    const confessionsQuery = useConfessions();
    const posts = confessionsQuery.data?.pages?.flatMap(p => p.posts) || [];
    const isLoading = confessionsQuery.isLoading;
    const loadingMore = confessionsQuery.isFetchingNextPage;

    // Optimistic/Interactive states for PostItem integration
    const [pickerPostId, setPickerPostId] = useState(null);
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const [savingPostIds, setSavingPostIds] = useState(new Set());
    const [sharePost, setSharePost] = useState(null);
    const [likesVisible, setLikesVisible] = useState(false);
    const [likesIds, setLikesIds] = useState([]);
    const lastTap = useRef({});

    // Mutations
    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const reactMutation = useReactPost();
    const followMutation = useFollowUser();

    // Zustand store helpers
    const isSaved = usePostStore(s => s.isSaved);
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);
    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);

    const handleMute = async (post) => {
        confirmDialog({
            message: `Are you sure you want to mute the author of this anonymous post? Their posts will be hidden from your feed.`,
            header: 'Mute User',
            icon: 'pi pi-volume-off',
            acceptLabel: 'Mute',
            acceptClassName: 'p-button-warning border-0 rounded-xl',
            rejectClassName: 'p-button-text p-button-secondary rounded-xl',
            accept: async () => {
                try {
                    await api.post(`/api/post/${post._id}/mute-author`);
                    toast.success('User muted');
                    queryClient.invalidateQueries({ queryKey: ['confessions'] });
                } catch (e) {
                    toast.error('Failed to mute user');
                }
            },
        });
    };

    const handleBlock = async (post) => {
        confirmDialog({
            message: `Are you sure you want to block the author of this anonymous post? They won't be able to see your profile or posts, and you won't see theirs.`,
            header: 'Block Confirmation',
            icon: 'pi pi-ban',
            acceptLabel: 'Block',
            acceptClassName: 'p-button-danger border-0 rounded-xl',
            rejectClassName: 'p-button-text p-button-secondary rounded-xl',
            accept: async () => {
                try {
                    await api.post(`/api/post/${post._id}/block-author`);
                    toast.success('User blocked');
                    queryClient.invalidateQueries({ queryKey: ['confessions'] });
                } catch (e) {
                    toast.error('Failed to block user');
                }
            },
        });
    };

    const submitReport = async (reason, customDetails) => {
        try {
            await api.post(`/api/moderation/report`, { postId: reportPost._id, reason, details: customDetails });
            toast.success('Report submitted. Thank you!');
            setReportPost(null);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to submit report');
        }
    };

    const handleLikeToggle = async (post) => {
        if (likeMutation.isPending) return;
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

    const handleReact = (post, emoji) => {
        if (navigator.vibrate) navigator.vibrate(15);
        reactMutation.mutate({ postId: post._id, emoji });
        setPickerPostId(null);
    };

    const handleFollow = (targetUserId) => {
        if (!targetUserId) return;
        followMutation.mutate({ targetUserId });
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

    if (isLoading) return <SkeletonCommunities />;

    if (posts.length === 0) return (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ fontSize: '36px', margin: 0 }}>🎭</p>
            <p style={{ fontWeight: 700, fontSize: '16px', margin: '12px 0 4px' }}>No confessions yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Be the first to post anonymously!</p>
        </div>
    );

    return (
        <div className='flex flex-col p-2 mt-1 gap-2'>
            {/* Info banner */}
            <div style={{ background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>🔒</span>
                <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>Anonymous Confessions</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#818cf8' }}>All identities are hidden. Post freely.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="mt-1 flex flex-col">{[1, 2, 3].map(i => <SkeletonPost key={i} />)}</div>
            ) : ""}

            <div className="mt-1 flex flex-col">
                {posts.map((post, i) => {
                    // Force isAnonymous to be true to fully safeguard anonymity under any circumstances
                    const safeAnonymousPost = { ...post, isAnonymous: true };
                    return (
                        <PostItem
                            key={post._id || i}
                            post={safeAnonymousPost}
                            user={user}
                            isLikedByMe={optimisticLikes[post._id]
                                ? Array.from(optimisticLikes[post._id]).some(id => id?.toString() === user?._id?.toString())
                                : (post.likes || []).some(id => id?.toString() === user?._id?.toString())
                            }
                            likesCount={optimisticLikes[post._id] ? optimisticLikes[post._id].size : (post.likes?.length || 0)}
                            isSavedByMe={isSaved(post._id)}
                            isFollowing={false} // Anonymous posts cannot be followed directly
                            heartVisible={!!heartVisible[post._id]}
                            visiblePostId={visiblePostId}
                            pickerPostId={pickerPostId}
                            savingPostIds={savingPostIds}
                            onLikeToggle={handleLikeToggle}
                            onImageDoubleClick={handleImageDoubleClick}
                            onImageTap={handleImageTap}
                            onSave={handleSave}
                            onDelete={() => { }} // Confessions cannot be deleted by users from discover tab
                            onReport={setReportPost}
                            onShareToStory={setSharingPostToStory}
                            onProfileClick={onProfileClick} // Allows clicks on non-anonymous comments
                            onSharePost={setSharePost}
                            onEdit={() => { }} // Confessions cannot be edited by users from discover tab
                            setVisibleCommentId={setVisiblePostId}
                            setPickerPostId={setPickerPostId}
                            handleDwell={() => { }} // Confessions dwell time tracking is optional/none
                            handleReact={handleReact}
                            renderCaption={renderCaption}
                            onFollow={handleFollow}
                            onLikesClick={(ids) => { setLikesIds(ids); setLikesVisible(true); }}
                            onMute={handleMute}
                            onBlock={handleBlock}
                        />
                    );
                })}
            </div>

            {/* Load more */}
            {confessionsQuery.hasNextPage && (
                <button onClick={() => confessionsQuery.fetchNextPage()} disabled={loadingMore}
                    style={{ padding: '12px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#808bf5' }}>
                    {loadingMore ? 'Loading...' : 'Load more confessions'}
                </button>
            )}

            {sharePost && <SharePostDialog
                visible={!!sharePost}
                onHide={() => setSharePost(null)}
                post={sharePost}
                user={user}
                onShareToStory={() => setSharingPostToStory(sharePost)}
            />}

            {reportPost && (
                <ReportDialog
                    visible={!!reportPost}
                    onHide={() => setReportPost(null)}
                    onSubmit={submitReport}
                />
            )}

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
    );
};

// ─── MAIN EXPLORE ─────────────────────────────────────────────────────────────
const Communities = () => {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userProfileVisible, setUserProfileVisible] = useState(false);

    // ✅ Tab: 'discover' | 'confessions'
    const [activeTab, setActiveTab] = useState('confessions');

    const tabContainerRef = useRef(null);
    const tabItemRefs = useRef({});
    const [tabPill, setTabPill] = useState({ left: 0, width: 0, opacity: 0 });
    const [tabPillReady, setTabPillReady] = useState(false);

    const handleProfileClick = (userId) => {
        setSelectedUserId(userId);
        setUserProfileVisible(true);
    };

    useLayoutEffect(() => {
        let observer = null;

        const updatePill = () => {
            const activeEl = tabItemRefs.current[activeTab];
            const container = tabContainerRef.current;
            if (!activeEl || !container) {
                setTabPill(s => ({ ...s, opacity: 0 }));
                return;
            }
            const cRect = container.getBoundingClientRect();
            const eRect = activeEl.getBoundingClientRect();
            setTabPill({
                left: eRect.left - cRect.left,
                width: eRect.width,
                opacity: 1
            });
            setTabPillReady(true);
        };

        updatePill();

        const container = tabContainerRef.current;
        if (container) {
            observer = new ResizeObserver(updatePill);
            observer.observe(container);
        }

        return () => {
            if (observer) observer.disconnect();
        };
    }, [activeTab]);


    return (
        <div className='max-w-[680px] my-0 mx-auto p-2'>

            {/* ── Tabs ── */}
            <div ref={tabContainerRef} style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', borderRadius: '14px', padding: '4px', marginBottom: '8px', border: '1px solid var(--border-color)', position: 'relative' }}>
                {/* Floating Pill */}
                <div
                    style={{
                        position: 'absolute',
                        top: '4px',
                        bottom: '4px',
                        left: tabPill.left,
                        width: tabPill.width,
                        borderRadius: '10px',
                        background: '#808bf5',
                        boxShadow: '0 4px 15px rgba(128,139,245,0.35)',
                        opacity: tabPillReady ? tabPill.opacity : 0,
                        transition: tabPillReady ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s ease, opacity 0.15s ease' : 'none',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }}
                />
                {[
                    { key: 'confessions', label: '🎭 Confessions' },
                    { key: 'communities', label: '👥 Communities' },
                ].map(tab => (
                    <button key={tab.key}
                        ref={el => tabItemRefs.current[tab.key] = el}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s', position: 'relative', zIndex: 1,
                            background: 'transparent',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-sub)',
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CONFESSIONS TAB ── */}
            {activeTab === 'confessions' && <ConfessionsFeed onProfileClick={handleProfileClick} />}

            {/* ── COMMUNITIES TAB ── */}
            {activeTab === 'communities' && <Groups />}


            <Dialog header="Profile" visible={userProfileVisible} style={{ width: '95vw', maxWidth: '450px', maxHeight: '90vh' }} onHide={() => setUserProfileVisible(false)}>
                <UserProfile id={selectedUserId} />
            </Dialog>
        </div>
    );
};

export default Communities;
