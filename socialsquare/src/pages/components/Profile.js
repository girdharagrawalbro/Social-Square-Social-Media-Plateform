import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useUserPosts, useSavedPosts, usePublicUserPosts } from '../../hooks/queries/usePostQueries';
import { useFollowUser, useUnfollowUser, useCollabInvites, useCancelFollowRequest, usePublicUserProfile, useMuteUser, useUnmuteUser, useBlockUser, useUnblockUser, useOwnProfile, useOtherUserProfile } from '../../hooks/queries/useAuthQueries';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import toast, { Toaster } from 'react-hot-toast';
import useWindowWidth from '../../hooks/useWindowWidth';



import EditProfile from './EditProfile';
import ActiveSessions from './ActiveSessions';
import FollowFollowingList from './FollowFollowingList';
import CollabManager from './CollabManager';
import PostCard from './ui/PostCard';
import PostDetail from './PostDetail';
import CreatorAnalytics from './CreatorAnalytics';
import SkeletonProfile from './ui/SkeletonProfile';

/**
 * Profile Component - FLEXIBLE PROFILE VIEW
 * 
 * ✅ CAN SHOW LOGGED-IN USER'S PROFILE (default, userId not provided):
 *    - Edit Profile, Logout, Security/Sessions, Saved Posts, Collabs Manager
 *    - Followers/Following lists for own profile
 * 
 * ✅ CAN ALSO SHOW OTHER USER'S PROFILE (pass userId prop):
 *    - View-only (no edit/logout)
 *    - Shows Follow/Message buttons
 *    - Shows Posts (no Saved/Collabs tabs for others)
 *    - Used when clicking "View full profile" from UserProfile popup
 */

const Profile = ({ userId }) => {
    const [editVisible, setEditVisible] = useState(false);
    const [activeSessionsVisible, setActiveSessionsVisible] = useState(false);
    const [showFollowersList, setShowFollowersList] = useState(false);
    const [showFollowingList, setShowFollowingList] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [postDetail, setPostDetail] = useState(null);
    const navigate = useNavigate();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;

    const tabContainerRef = useRef(null);
    const tabItemRefs = useRef({});
    const [tabPill, setTabPill] = useState({ left: 0, width: 0, opacity: 0 });
    const [tabPillReady, setTabPillReady] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [showCloseFriendsList, setShowCloseFriendsList] = useState(false);

    const [collections, setCollections] = useState([]);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [collectionPosts, setCollectionPosts] = useState([]);
    const [loadingCollectionPosts, setLoadingCollectionPosts] = useState(false);
    const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [creatingCollection, setCreatingCollection] = useState(false);

    useEffect(() => {
        if (activeTab === 'saved') {
            fetchCollections();
        } else {
            setSelectedCollection(null);
        }
    }, [activeTab]);

    const fetchCollections = async () => {
        try {
            const res = await api.get('/api/post/collections/all');
            setCollections(res.data || []);
        } catch (error) {
            console.error('Failed to fetch collections', error);
        }
    };

    const handleOpenCollection = (col) => {
        setSelectedCollection(col);
        if (col && col !== 'all') {
            fetchCollectionPosts(col._id);
        }
    };

    const fetchCollectionPosts = async (collectionId) => {
        setLoadingCollectionPosts(true);
        try {
            const res = await api.get(`/api/post/collections/${collectionId}`);
            setCollectionPosts(res.data.posts || []);
        } catch (error) {
            toast.error('Failed to load collection posts');
        } finally {
            setLoadingCollectionPosts(false);
        }
    };

    const handleCreateCollectionProfile = async (e) => {
        e.preventDefault();
        if (!newCollectionName.trim()) return;
        setCreatingCollection(true);
        try {
            await api.post('/api/post/collections/create', { name: newCollectionName.trim() });
            toast.success(`Created collection "${newCollectionName}"`);
            setNewCollectionName('');
            setShowNewCollectionDialog(false);
            fetchCollections();
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to create collection';
            toast.error(msg);
        } finally {
            setCreatingCollection(false);
        }
    };

    const handleDeleteCollection = async (colId, e) => {
        if (e) e.stopPropagation();
        confirmDialog({
            message: 'Are you sure you want to delete this collection? The saved posts will not be deleted.',
            header: 'Delete Collection',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.delete(`/api/post/collections/${colId}`);
                    toast.success('Collection deleted');
                    setSelectedCollection(null);
                    fetchCollections();
                } catch {
                    toast.error('Failed to delete collection');
                }
            }
        });
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
    const loggeduser = useAuthStore(s => s.user);
    const initialized = useAuthStore(s => s.initialized);

    const getUserIdFromToken = useAuthStore(s => s.getUserIdFromToken);

    // ─── RACE-CONDITION-FREE IDENTITY RESOLUTION ──────────────────────────────
    // tokenUserId is decoded from the in-memory JWT synchronously — it is set
    // before Zustand hydrates (see refreshAccessToken → updateAuthToken → setToken).
    // This means we can safely compare it with the URL userId without any race.
    const tokenUserId = getUserIdFromToken();
    const currentUserId = loggeduser?._id || tokenUserId;
    const profileId = userId || currentUserId;

    const isLoggedOut = initialized && !currentUserId;

    // viewingOwnProfile: INITIAL IDENTITY GUESS (Race-condition-free signals)
    //   1. No userId in URL → own profile route (/profile with no param)
    //   2. userId === tokenUserId → sync token check (no Zustand lag)
    //   3. userId === currentUserId → Zustand fallback
    const viewingOwnProfile = !userId ||
        (!!tokenUserId && userId === tokenUserId) ||
        (!!currentUserId && userId === currentUserId);

    const { mutate: blockUserMut } = useBlockUser();
    const { mutate: unblockUserMut } = useUnblockUser();
    const { mutate: muteUserMut } = useMuteUser();
    const { mutate: unmuteUserMut } = useUnmuteUser();

    // Fetch own posts/saved (Logged In)
    const {
        data: userPosts,
        isLoading: loadingUserPosts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useUserPosts((initialized && currentUserId) ? profileId : null);

    const { ref: loadMoreRef, inView } = useInView({
        threshold: 0,
        rootMargin: '100px',
    });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);
    const { data: savedPostsData = [] } = useSavedPosts((initialized && currentUserId && viewingOwnProfile) ? profileId : null);

    // Fetch public posts (Logged Out)
    const { data: publicPostsData = [], isLoading: loadingPublicPosts } = usePublicUserPosts((initialized && !currentUserId) ? profileId : null);

    const userPostsList = isLoggedOut ? (publicPostsData?.posts || []) : (userPosts?.pages?.flatMap(p => p.posts) || []);
    const savedPosts = savedPostsData || [];

    // ─── SEPARATE INTENT-BASED PROFILE QUERIES ────────────────────────────────
    // Own profile: calls /api/auth/me — resolved by JWT, never needs Zustand
    const { data: ownProfileData, isLoading: ownProfileLoading } = useOwnProfile(
        initialized && !!currentUserId && viewingOwnProfile
    );

    // Other profile: calls /api/auth/other-user/view/:id — only fires when userId is in URL
    const { data: otherProfileData, isLoading: otherProfileLoading } = useOtherUserProfile(
        (initialized && !!currentUserId && !viewingOwnProfile) ? userId : null
    );

    // Public profile: for logged-out visitors
    const { data: publicUserProfile, isLoading: publicProfileLoading } = usePublicUserProfile(
        (initialized && !currentUserId) ? profileId : null
    );

    const displayUser = isLoggedOut ? publicUserProfile
        : viewingOwnProfile ? ownProfileData
            : otherProfileData;

    const profileLoading = isLoggedOut ? publicProfileLoading
        : viewingOwnProfile ? ownProfileLoading
            : otherProfileLoading;

    // ─── THE CONCLUSIVE OWNERSHIP FLAG ────────────────────────────────────────
    // Final safety net: if profile data arrives and matches currentUserId, it's definitely own profile
    const isOwner = viewingOwnProfile || (!!displayUser?._id && displayUser._id?.toString() === currentUserId?.toString());

    // Follow/Unfollow mutations
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();
    const cancelRequestMutation = useCancelFollowRequest();

    // isFollowing: owner always sees own content; others check API + local store
    const isFollowing = !isLoggedOut && (
        isOwner ||
        loggeduser?.following?.some(f => f?.toString() === profileId?.toString()) ||
        otherProfileData?.isFollowing === true
    );

    const isRequested = !isLoggedOut && (
        otherProfileData?.hasPendingRequest ||
        otherProfileData?.followRequests?.some(r => (r?.userId || r)?.toString() === currentUserId?.toString())
    );

    const isBlockedByMe = !isLoggedOut && loggeduser?.blockedUsers?.some(b => b?.toString() === profileId?.toString());
    const isMuted = !isLoggedOut && loggeduser?.mutedUsers?.some(m => m?.toString() === profileId?.toString());

    // Private gate: only applies to other users' private accounts
    const isPrivateAndNotFollowing = initialized && !profileLoading && !isOwner && displayUser?.isPrivate && !isFollowing;

    const handleFollow = async () => {
        try {
            const res = await followMutation.mutateAsync({ targetUserId: profileId });
            if (res.requested) {
                toast.success('Follow request sent');
            } else {
                toast.success('Following');
            }
        } catch {
            toast.error('Failed to send follow request');
        }
    };

    const handleUnfollow = () => {
        confirmDialog({
            message: `Are you sure you want to unfollow ${displayUser.fullname}?`,
            header: 'Unfollow User',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Unfollow',
            rejectLabel: 'Cancel',
            acceptClassName: 'p-button-danger',
            accept: () => unfollowMutation.mutate({ targetUserId: profileId }),
        });
    };
    const handleCancelRequest = () => {
        confirmDialog({
            message: 'Do you want to cancel your follow request?',
            header: 'Cancel Request',
            icon: 'pi pi-times-circle',
            acceptLabel: 'Withdraw Request',
            rejectLabel: 'Keep',
            acceptClassName: 'p-button-secondary',
            accept: () => cancelRequestMutation.mutate({ targetUserId: profileId }),
        });
    };


    const handleBlock = () => {
        confirmDialog({
            message: `Block ${displayUser.fullname}? They won't be able to see your posts or message you.`,
            header: 'Block User',
            icon: 'pi pi-ban',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Yes, Block',
            rejectLabel: 'Cancel',
            accept: () => {
                blockUserMut({ targetUserId: profileId });
                toast.success(`Blocked ${displayUser.fullname}`);
            },
        });
    };

    const handleUnblock = () => {
        confirmDialog({
            message: `Unblock ${displayUser.fullname}? They will be able to see your posts again.`,
            header: 'Unblock User',
            icon: 'pi pi-check-circle',
            acceptLabel: 'Yes, Unblock',
            rejectLabel: 'Cancel',
            accept: () => {
                unblockUserMut({ targetUserId: profileId });
                toast.success(`Unblocked ${displayUser.fullname}`);
            },
        });
    };

    const handleMute = () => {
        if (isMuted) {
            confirmDialog({
                message: `Unmute ${displayUser.fullname}? You will start seeing their posts again.`,
                header: 'Unmute User',
                icon: 'pi pi-volume-up',
                acceptLabel: 'Yes, Unmute',
                rejectLabel: 'Cancel',
                accept: () => {
                    unmuteUserMut({ targetUserId: profileId });
                    toast.success(`Unmuted ${displayUser.fullname}`);
                },
            });
        } else {
            confirmDialog({
                message: `Mute ${displayUser.fullname}? Their posts won't appear in your feed.`,
                header: 'Mute User',
                icon: 'pi pi-volume-off',
                acceptLabel: 'Yes, Mute',
                rejectLabel: 'Cancel',
                accept: () => {
                    muteUserMut({ targetUserId: profileId });
                    toast.success(`Muted ${displayUser.fullname}`);
                },
            });
        }
    };

    const { data: collabInvites = [] } = useCollabInvites((initialized && currentUserId && viewingOwnProfile) ? profileId : null);

    // Strict Loading Gate: Wait for both auth initialized AND the relevant profile data
    if (!initialized) return <SkeletonProfile />;
    if (isLoggedOut && (publicProfileLoading || !displayUser)) return <SkeletonProfile />;
    if (!isLoggedOut && (profileLoading || !displayUser)) return <SkeletonProfile />;
    if (!isLoggedOut && isOwner && (loadingUserPosts && !userPosts)) return <SkeletonProfile />;

    if (!displayUser) return <div className="text-center p-4">Profile not found</div>;

    const pendingCollabCount = collabInvites.length;

    // Only posts/saved use the grid
    const tabPosts = activeTab === 'posts' ? userPostsList : savedPosts;
    const isLoadingTab = activeTab === 'posts' ? (isLoggedOut ? loadingPublicPosts : loadingUserPosts) : false;

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    // Tabs: own profile shows Posts/Saved/Collabs, other profiles show Posts only
    const TABS = isOwner
        ? [
            { key: 'posts', icon: 'pi pi-table', label: 'Posts' },
            { key: 'reels', icon: 'pi pi-video', label: 'Reels' },
            { key: 'saved', icon: 'pi pi-bookmark', label: 'Saved' },
            {
                key: 'collabs',
                icon: 'pi pi-users',
                label: 'Collabs',
                badge: pendingCollabCount > 0 ? pendingCollabCount : null
            },
            { key: 'analytics', icon: 'pi pi-chart-bar', label: 'Insights' },
        ]
        : [
            { key: 'posts', icon: 'pi pi-table', label: 'Posts' },
            { key: 'reels', icon: 'pi pi-video', label: 'Reels' },
        ];

    return (
        <>
            <div className="w-full max-w-4xl mx-auto">
                <div className="flex right-0 lg:right-[5rem] fixed lg:top-6 z-50">
                    {displayUser.isAdmin ?
                        <button
                            onClick={() => { navigate('/admin'); }}
                            className={`text-left px-3 py-2.5 rounded-xl border-0 bg-transparent cursor-pointer flex items-center gap-4 font-medium transition-colors'}`}
                            title="Sessions"
                        >
                            <i className="pi pi-shield text-lg"></i>
                        </button>
                        :
                        ""
                    }
                    <button
                        onClick={() => { setSettingsVisible(true); }}
                        className={`text-left px-3 py-2.5 rounded-xl border-0 bg-transparent cursor-pointer flex items-center gap-4 font-medium transition-colors'}`}
                        title="Settings"
                    >
                        <i className="pi pi-cog text-lg"></i>
                    </button>
                </div>
                <div className="bg-[var(--surface-1)] flex flex-col min-h-screen">

                    {/* Header: Sticky Profile Info */}
                    <div className="bg-[var(--surface-1)] bg-opacity-90 backdrop-blur-md py-2 sm:py-0 sm:px-0 sm:mx-0 sm:px-0 max-w-xl w-full mx-auto">
                        {/* Avatar + identity */}
                        <div className="flex items-center justify-center text-center flex-col gap-1 mb-3">
                            <div className="relative">
                                <Image
                                    src={displayUser?.profile_picture}
                                    zoomSrc={displayUser?.profile_picture}
                                    alt="Profile"
                                    className="profile-image-square overflow-hidden border-2 border-indigo-500/20"
                                    style={{ '--size': '80px' }}
                                    preview
                                />
                                {displayUser?.isOnline && (
                                    <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--surface-1)] rounded-full shadow-sm z-10" title="Online now">
                                        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-25"></div>
                                    </div>
                                )}
                                {isOwner && (
                                    <button
                                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-0 cursor-pointer bg-[#4f46e5] text-white flex items-center justify-center shadow-md z-10"
                                        onClick={() => setEditVisible(true)}
                                        title="Edit profile"
                                    >
                                        <i className="pi pi-pencil text-[11px]"></i>
                                    </button>
                                )}
                            </div>

                            <h3 className="m-0 text-lg sm:text-xl lg:text-2xl font-semibold text-[var(--text-main)]">{displayUser?.fullname}</h3>
                            {displayUser?.username && (
                                <p className="m-0 text-sm font-medium text-indigo-600">@{displayUser.username}</p>
                            )}
                            {displayUser?.bio && (
                                <p className="text-sm text-[var(--text-sub)] m-0 max-w-[260px] leading-6">{displayUser.bio}</p>
                            )}
                            {!isOwner && displayUser?.mutualCount > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex -space-x-2">
                                        {displayUser.mutualFollowers?.slice(0, 3).map((m, idx) => (
                                            <img
                                                key={m._id}
                                                src={m.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                                                alt={m.fullname}
                                                className="w-5 h-5 rounded-full border-2 border-[var(--surface-1)] object-cover"
                                                style={{ zIndex: 3 - idx }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-[var(--text-sub)] m-0">
                                        Followed by <strong>{displayUser.mutualFollowers?.[0]?.fullname || 'someone you know'}</strong>
                                        {displayUser.mutualCount > 1 ? ` and ${displayUser.mutualCount - 1} other${displayUser.mutualCount > 2 ? 's' : ''}` : ''}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Level/Streak/XP */}
                        {!isPrivateAndNotFollowing && !isBlockedByMe && (
                            <div className="flex gap-3 justify-center mb-3">
                                <div className="flex flex-col items-center bg-[var(--surface-2)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] min-w-[70px]">
                                    <span className="text-[9px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Level</span>
                                    <span className="text-lg font-black text-[#808bf5]">{displayUser?.level || 1}</span>
                                </div>
                                <div className="flex flex-col items-center bg-[var(--surface-2)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] min-w-[70px]">
                                    <span className="text-[9px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Streak</span>
                                    <span className="text-lg font-black text-orange-500 flex items-center gap-1">{displayUser?.streak?.count || 0} <span className='text-sm'>🔥</span></span>
                                </div>
                                <div className="flex flex-col items-center bg-[var(--surface-2)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] min-w-[70px]">
                                    <span className="text-[9px] uppercase font-bold text-[var(--text-sub)] tracking-wider">XP</span>
                                    <span className="text-lg font-black text-green-500">{(displayUser?.xp || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Stats tiles */}
                        {!isBlockedByMe && (
                            <div className="grid grid-cols-4 gap-1 sm:gap-3 mb-4 px-2">
                                <div
                                    className={`rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center transition-all px-1 sm:px-4 cursor-pointer ${isOwner || isFollowing ? 'cursor-pointer hover:bg-[var(--surface-1)] active:scale-95' : 'opacity-60 cursor-pointer'}`}
                                    onClick={() => {
                                        if (isLoggedOut) {
                                            toast.error('Log in to view followers', { icon: '🔒' });
                                            navigate('/login');
                                        } else if (isOwner || isFollowing) {
                                            setShowFollowersList(true);
                                        } else {
                                            toast.error('Follow this user to see their followers', { icon: '🔒' });
                                        }
                                    }}
                                >
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center">{formatCount(displayUser?.followerCount ?? displayUser?.followers?.length ?? 0)}</h6>
                                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Followers</span>
                                </div>
                                <div
                                    className={`rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center transition-all px-1 sm:px-4 ${isOwner || isFollowing ? 'cursor-pointer hover:bg-[var(--surface-1)] active:scale-95' : 'opacity-60 cursor-pointer'}`}
                                    onClick={() => {
                                        if (isLoggedOut) {
                                            toast.error('Log in to view following', { icon: '🔒' });
                                            navigate('/login');
                                        } else if (isOwner || isFollowing) {
                                            setShowFollowingList(true);
                                        } else {
                                            toast.error('Follow this user to see who they follow', { icon: '🔒' });
                                        }
                                    }}
                                >
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center ">{formatCount(displayUser?.followingCount ?? displayUser?.following?.length ?? 0)}</h6>
                                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block" style={{ whiteSpace: 'nowrap' }}>Following</span>
                                </div>
                                <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center cursor-pointer px-1 sm:px-4">
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center">{formatCount(displayUser?.postCount ?? 0)}</h6>
                                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Posts</span>
                                </div>
                                <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center cursor-pointer px-1 sm:px-4" title="Total profile views">
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center">{formatCount(displayUser?.profileViews || 0)}</h6>
                                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Views</span>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="mb-4">
                            {isLoggedOut ? (
                                <div className="grid grid-cols-1">
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm cursor-pointer hover:opacity-95 shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                    >
                                        <i className="pi pi-sign-in"></i>
                                        <span>Log In to Interact</span>
                                    </button>
                                </div>
                            ) : isOwner ? (
                                <></>
                            ) : !isBlockedByMe && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={isFollowing ? handleUnfollow : isRequested ? handleCancelRequest : handleFollow}
                                        disabled={followMutation.isPending || unfollowMutation.isPending || cancelRequestMutation.isPending}
                                        className={`h-10 sm:h-11 lg:h-12 rounded-xl border font-semibold text-sm cursor-pointer transition ${isFollowing || isRequested
                                            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'
                                            : 'border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-95 shadow-lg shadow-indigo-500/20'}`}
                                    >
                                        {followMutation.isPending || unfollowMutation.isPending || cancelRequestMutation.isPending ? '...' : (isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow')}
                                    </button>
                                    <button
                                        onClick={() => navigate(`/conversation/${profileId}`)}
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 font-semibold text-sm cursor-pointer hover:bg-indigo-500/20 transition flex items-center justify-center gap-2"
                                    >
                                        <i className="pi pi-send"></i>
                                        <span>Message</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* OTHER PROFILE - Mute/Block Options */}
                        {!isOwner && !isLoggedOut && (
                            <div className="py-2 border-t border-b border-[var(--border-color)] flex divide-x divide-[var(--border-color)] my-2">
                                <button
                                    onClick={handleMute}
                                    className="flex-1 flex items-center justify-center gap-2 text-xs text-[var(--text-sub)] hover:text-orange-500 transition border-0 bg-transparent cursor-pointer font-bold py-2.5"
                                >
                                    <i className={`pi ${isMuted ? 'pi-volume-up' : 'pi-volume-off'} text-sm`}></i>
                                    {isMuted ? 'Unmute' : 'Mute'}
                                </button>
                                {!isBlockedByMe && (
                                    <button
                                        onClick={handleBlock}
                                        className="flex-1 flex items-center justify-center gap-2 text-xs text-[var(--text-sub)] hover:text-red-500 transition border-0 bg-transparent cursor-pointer font-bold py-2.5"
                                    >
                                        <i className="pi pi-ban text-sm"></i>
                                        Block
                                    </button>
                                )}
                                {isBlockedByMe && (
                                    <button
                                        onClick={handleUnblock}
                                        className="flex-1 flex items-center justify-center gap-2 text-xs text-red-500 hover:text-red-600 transition border-0 bg-transparent cursor-pointer font-bold py-2.5"
                                    >
                                        <i className="pi pi-check text-sm"></i>
                                        Unblock
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Tabs */}
                        {!isPrivateAndNotFollowing && !isBlockedByMe && (
                            <div className="flex relative items-center bg-[var(--surface-1)] border-t border-[var(--border-color)]" ref={tabContainerRef}>
                                {/* Floating Indicator Line (Top) */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '-1px',
                                        left: tabPill.left,
                                        width: tabPill.width,
                                        height: '1px',
                                        background: 'var(--text-main)',
                                        opacity: tabPillReady ? tabPill.opacity : 0,
                                        transition: tabPillReady ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s ease' : 'none',
                                        zIndex: 20
                                    }}
                                />
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        ref={el => tabItemRefs.current[tab.key] = el}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex-1 py-2.5 flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer relative z-10 transition-all ${activeTab === tab.key ? 'text-[var(--text-main)]' : 'text-[var(--text-sub)] opacity-50 hover:opacity-100'}`}
                                        title={tab.label}
                                    >
                                        <div className="relative">
                                            <i className={`${tab.icon} text-lg`}></i>
                                            {tab.badge && (
                                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] px-1 rounded-full font-bold">
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    {isBlockedByMe ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[var(--surface-2)] rounded-3xl mx-4 mb-4 border border-[var(--border-color)]">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-500/20">
                                <i className="pi pi-ban text-3xl text-red-500"></i>
                            </div>
                            <h3 className="m-0 text-[var(--text-main)] font-black text-xl mb-2">User Blocked</h3>
                            <p className="m-0 text-sm text-[var(--text-sub)] max-w-[300px] leading-relaxed">
                                You have blocked this user. Unblock them to see their posts and profile details.
                            </p>
                        </div>
                    ) : isPrivateAndNotFollowing ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--surface-2)] rounded-2xl mx-4 mb-4 border border-dashed border-[var(--border-color)]">
                            <div className="w-16 h-16 bg-[var(--surface-1)] rounded-full flex items-center justify-center shadow-sm mb-4">
                                <i className="pi pi-lock text-3xl text-[var(--text-sub)]"></i>
                            </div>
                            <h4 className="m-0 text-[var(--text-main)] font-bold text-lg mb-2">This Account is Private</h4>
                            <p className="m-0 text-sm text-[var(--text-sub)]">
                                {isLoggedOut ? 'Log in to see their photos and videos.' : 'Follow to see their photos and videos.'}
                            </p>
                            {isLoggedOut && (
                                <button
                                    onClick={() => navigate('/login')}
                                    className="mt-4 px-4 py-2 rounded-xl border-0 bg-indigo-600 text-white font-semibold text-xs cursor-pointer hover:bg-indigo-700 transition"
                                >
                                    Log In
                                </button>
                            )}
                        </div>
                    ) : activeTab === 'collabs' ? (
                        // Collabs tab — full width, no grid
                        <CollabManager mode="all" />
                    ) : activeTab === 'analytics' ? (
                        // Analytics tab
                        <div className="px-2">
                            <CreatorAnalytics userId={profileId} />
                        </div>
                    ) : (
                        // Posts / Saved — Grid / Collections
                        <div className="w-full">
                            {activeTab === 'saved' && selectedCollection === null ? (
                                <div className="p-2">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {/* Create Collection Card */}
                                        <div onClick={() => setShowNewCollectionDialog(true)} style={{ cursor: 'pointer' }} className="flex flex-col gap-2 relative group">
                                            <div style={{ aspectRatio: '1', background: 'var(--surface-2)', borderRadius: '16px', border: '2px dashed var(--border-color)' }} className="relative w-full flex flex-col items-center justify-center gap-2 hover:bg-[var(--surface-3)] transition-colors">
                                                <i className="pi pi-plus text-3xl text-indigo-500"></i>
                                                <span className="text-xs font-bold text-indigo-500">New Collection</span>
                                            </div>
                                        </div>

                                        {/* All Saved Posts Card */}
                                        <div onClick={() => handleOpenCollection('all')} style={{ cursor: 'pointer' }} className="flex flex-col gap-2 relative group animate-fade-in">
                                            <div style={{ aspectRatio: '1', background: 'var(--surface-2)', borderRadius: '16px', border: '1px solid var(--border-color)' }} className="relative overflow-hidden w-full flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors">
                                                {savedPosts.length > 0 && (savedPosts[0].image_urls?.[0] || savedPosts[0].image_url || savedPosts[0].videoThumbnail) ? (
                                                    <img src={savedPosts[0].image_urls?.[0] || savedPosts[0].image_url || savedPosts[0].videoThumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                                                ) : (
                                                    <i className="pi pi-bookmark-fill text-4xl text-[var(--text-sub)] opacity-30"></i>
                                                )}
                                            </div>
                                            <div className="px-1 flex flex-col">
                                                <h4 className="m-0 text-sm font-bold text-[var(--text-main)]">All Posts</h4>
                                                <span className="text-[10px] text-[var(--text-sub)]">{savedPosts.length} posts</span>
                                            </div>
                                        </div>

                                        {/* Custom Collections Cards */}
                                        {collections.map(c => (
                                            <div key={c._id} onClick={() => handleOpenCollection(c)} style={{ cursor: 'pointer' }} className="flex flex-col gap-2 relative group animate-fade-in">
                                                <div style={{ aspectRatio: '1', background: 'var(--surface-2)', borderRadius: '16px', border: '1px solid var(--border-color)' }} className="relative overflow-hidden w-full flex items-center justify-center">
                                                    {c.coverImage ? (
                                                        <img src={c.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                                                    ) : (
                                                        <i className="pi pi-bookmark text-4xl text-[var(--text-sub)] opacity-30"></i>
                                                    )}
                                                </div>
                                                <div className="px-1 flex justify-between items-center">
                                                    <div className="min-w-0">
                                                        <h4 className="m-0 text-sm font-bold text-[var(--text-main)] truncate" style={{ maxWidth: '100px' }}>{c.name}</h4>
                                                        <span className="text-[10px] text-[var(--text-sub)]">{c.postCount} posts</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteCollection(c._id, e)}
                                                        className="w-7 h-7 rounded-full border-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer shrink-0"
                                                        title="Delete Collection"
                                                    >
                                                        <i className="pi pi-trash text-xs"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {/* Collection Header */}
                                    {activeTab === 'saved' && selectedCollection && (
                                        <div className="px-4 py-2 border-b border-[var(--border-color)] mb-3 flex items-center justify-between">
                                            <button
                                                onClick={() => setSelectedCollection(null)}
                                                className="flex items-center gap-1 text-sm bg-transparent border-0 text-[#808bf5] cursor-pointer font-bold"
                                            >
                                                <i className="pi pi-chevron-left"></i> Collections
                                            </button>
                                            <span className="text-sm font-black text-[var(--text-main)]">
                                                {selectedCollection === 'all' ? 'All Posts' : selectedCollection.name}
                                            </span>
                                            {selectedCollection !== 'all' ? (
                                                <button
                                                    onClick={(e) => handleDeleteCollection(selectedCollection._id, e)}
                                                    className="w-8 h-8 rounded-full border-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center cursor-pointer"
                                                    title="Delete Collection"
                                                >
                                                    <i className="pi pi-trash"></i>
                                                </button>
                                            ) : (
                                                <div className="w-8 h-8" />
                                            )}
                                        </div>
                                    )}

                                    {/* Posts Grid */}
                                    <div className="grid grid-cols-3 gap-[1px] sm:gap-[1px] pb-16 md:pb-0">
                                        {isLoadingTab || loadingCollectionPosts ? (
                                            [1, 2, 3].map(i => (
                                                <div key={i} className="bg-[var(--surface-2)] animate-pulse" style={{ aspectRatio: '1' }} />
                                            ))
                                        ) : (() => {
                                            let displayPosts = [];
                                            if (activeTab === 'posts') {
                                                displayPosts = userPostsList;
                                            } else if (activeTab === 'reels') {
                                                displayPosts = userPostsList.filter(p => !!p.video);
                                            } else if (activeTab === 'saved') {
                                                displayPosts = selectedCollection === 'all' ? savedPosts : collectionPosts;
                                            }

                                            if (!isLoggedOut && !isOwner && !isFollowing) {
                                                displayPosts = displayPosts.slice(0, 3);
                                            }

                                            return displayPosts.length > 0 ? (
                                                displayPosts.map((post, index) => (
                                                    <PostCard
                                                        key={post._id}
                                                        post={post}
                                                        isBlur={(isLoggedOut && index > 8) || (!viewingOwnProfile && !isFollowing)}
                                                        onClick={(post) => {
                                                            if (isLoggedOut) {
                                                                toast.error('Log in to view full post', { icon: '🔒' });
                                                                navigate('/login');
                                                            } else if (isOwner || isFollowing) {
                                                                setPostDetail(post);
                                                                setPostDetailVisible(true);
                                                            } else {
                                                                toast.error('Follow this user to see the full post', { icon: '🔒' });
                                                            }
                                                        }}
                                                    />
                                                ))
                                            ) : (
                                                <div className="col-span-3">
                                                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                                        <i className={`pi ${activeTab === 'reels' ? 'pi-video' : 'pi-images'} text-4xl text-[var(--text-sub)] opacity-20 mb-4`}></i>
                                                        <h3 className="m-0 text-[var(--text-main)] font-bold text-base">No {activeTab} yet</h3>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Load More Trigger */}
                    {activeTab === 'posts' && hasNextPage && !isPrivateAndNotFollowing && (
                        <div ref={loadMoreRef} className="flex justify-center mt-6 mb-8 h-10">
                            {isFetchingNextPage && (
                                <div className="text-indigo-500 font-bold text-sm flex items-center gap-2">
                                    <i className="pi pi-spin pi-spinner"></i>
                                    <span>Loading...</span>
                                </div>
                            )}
                        </div>
                    )}

                    {isLoggedOut && tabPosts.length > 3 && (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-[var(--surface-2)]/80 backdrop-blur-lg rounded-2xl mx-4 mt-4 mb-4 border border-[var(--border-color)]">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                                <i className="pi pi-lock text-xl text-indigo-600"></i>
                            </div>
                            <h4 className="m-0 text-[var(--text-main)] font-bold text-base mb-2">Log in to see more</h4>
                            <p className="m-0 text-xs text-[var(--text-sub)] max-w-[250px] mb-4">
                                Log in to view all posts and interact with the community.
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="px-6 py-2.5 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm cursor-pointer hover:opacity-95 shadow-md transition flex items-center justify-center gap-2"
                            >
                                <i className="pi pi-sign-in"></i>
                                <span>Log In</span>
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* Edit & Security Dialogs - Own Profile Only */}
            {isOwner && (
                <>
                    <Dialog header="Edit Profile" visible={editVisible} position="center" style={{ width: '90vw', maxWidth: '500px', height: '80vh' }} onHide={() => setEditVisible(false)}>
                        <EditProfile users={loggeduser} closeSidebar={() => setEditVisible(false)} />
                    </Dialog>
                    <Dialog header="Security & Sessions" visible={activeSessionsVisible} position="center" style={{ width: '90vw', maxWidth: '500px', height: '100vh' }} onHide={() => setActiveSessionsVisible(false)}>
                        <ActiveSessions />
                    </Dialog>
                </>
            )}

            {/* Followers / Following Dialogs - Accessible if following or own profile */}
            <Dialog
                header="Followers"
                visible={showFollowersList}
                style={{ width: '90vw', maxWidth: '420px', height: '80vh' }}
                onHide={() => setShowFollowersList(false)}
                className="rounded-3xl"
            >
                <FollowFollowingList isfollowing={false} userId={displayUser?._id} />
            </Dialog>
            <Dialog
                header="Following"
                visible={showFollowingList}
                style={{ width: '90vw', maxWidth: '420px', height: '80vh' }}
                onHide={() => setShowFollowingList(false)}
                className="rounded-3xl"
            >
            </Dialog>

            <Dialog
                header="Close Friends"
                visible={showCloseFriendsList}
                style={{ width: '90vw', maxWidth: '420px', height: '80vh' }}
                onHide={() => setShowCloseFriendsList(false)}
                className="rounded-3xl"
            >
                <FollowFollowingList userId={loggeduser?._id} ids={loggeduser?.closeFriends || []} />
            </Dialog>



            {/* Post Detail Dialog - Shared */}
            <Dialog
                showHeader={false}
                visible={postDetailVisible}
                style={{ width: isDesktop ? '95vw' : '100vw', maxWidth: isDesktop ? '1200px' : 'none', height: isDesktop ? '90vh' : '100dvh' }}
                position="center"
                onHide={() => setPostDetailVisible(false)}
                contentStyle={{ padding: 0, borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', background: 'transparent' }}
                baseZIndex={20000}
                blockScroll={true}
                closable={false}
            >
                <div className="relative bg-[var(--surface-1)] h-full w-full" style={{ borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', border: isDesktop ? '1px solid var(--border-color)' : 'none' }}>
                    <button
                        onClick={() => setPostDetailVisible(false)}
                        className="absolute top-4 left-4 z-[20005] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg"
                    >
                        <i className="pi pi-times text-sm"></i>
                    </button>
                    <React.Suspense fallback={<div className="p-20 text-center text-[var(--text-sub)] bg-[var(--surface-1)]">
                        <div className="inline-block w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-medium">Loading Post...</p>
                    </div>}>
                        <PostDetail post={postDetail} onHide={() => setPostDetailVisible(false)} />
                    </React.Suspense>
                </div>
            </Dialog>

            <Dialog
                header="Settings"
                visible={settingsVisible}
                style={{ width: '90vw', maxWidth: '400px' }}
                onHide={() => setSettingsVisible(false)}
                className="custom-dialog"
            >
                <div className="flex flex-col gap-2 py-1 pb-2 px-2">
                    <button
                        onClick={() => {
                            setSettingsVisible(false);
                            navigate('/settings/notifications');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] hover:bg-[var(--surface-3)] cursor-pointer text-left transition-all active:scale-95"
                    >
                        <span className="text-xl">🔔</span>
                        <div className="flex-1">
                            <p className="m-0 text-sm font-bold">Notification Settings</p>
                            <p className="m-0 text-[10px] text-[var(--text-sub)] opacity-70 mt-0.5">Toggle daily digest emails and preferences</p>
                        </div>
                        <i className="pi pi-chevron-right text-[10px] text-gray-400"></i>
                    </button>

                    <button
                        onClick={() => {
                            setSettingsVisible(false);
                            navigate('/sessions');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] hover:bg-[var(--surface-3)] cursor-pointer text-left transition-all active:scale-95"
                    >
                        <span className="text-xl">🔑</span>
                        <div className="flex-1">
                            <p className="m-0 text-sm font-bold">Active Sessions & Security</p>
                            <p className="m-0 text-[10px] text-[var(--text-sub)] opacity-70 mt-0.5">Manage logged in devices and 2FA settings</p>
                        </div>
                        <i className="pi pi-chevron-right text-[10px] text-gray-400"></i>
                    </button>

                    <button
                        onClick={() => {
                            setSettingsVisible(false);
                            setShowCloseFriendsList(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] hover:bg-[var(--surface-3)] cursor-pointer text-left transition-all active:scale-95"
                    >
                        <span className="text-xl pr-2"><i className='pi pi-star-fill text-xl text-green-500' /></span>
                        <div className="flex-1">
                            <p className="m-0 text-sm font-bold">Close Friends</p>
                            <p className="m-0 text-[10px] text-[var(--text-sub)] opacity-70 mt-0.5">Manage your close friends list</p>
                        </div>
                        <i className="pi pi-chevron-right text-[10px] text-gray-400"></i>
                    </button>

                    {/* <button
                        onClick={() => setSettingsVisible(false)}
                        className="w-full mt-2 py-3 rounded-xl border border-dashed border-[var(--border-color)] bg-transparent text-[var(--text-sub)] hover:text-[var(--text-main)] hover:border-gray-400 cursor-pointer font-bold uppercase tracking-wider text-xs transition-all active:scale-95"
                    >
                        Cancel
                    </button> */}
                </div>
            </Dialog>

            {/* Create Collection Dialog */}
            <Dialog
                header="Create Collection"
                visible={showNewCollectionDialog}
                style={{ width: '90vw', maxWidth: '380px' }}
                onHide={() => setShowNewCollectionDialog(false)}
                dismissableMask
                baseZIndex={21000}
            >
                <form onSubmit={handleCreateCollectionProfile} className="flex flex-col gap-4 p-1">
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-[var(--text-sub)] uppercase">Collection Name</span>
                        <input
                            type="text"
                            placeholder="e.g. Travel, Food, Coding..."
                            value={newCollectionName}
                            onChange={e => setNewCollectionName(e.target.value)}
                            disabled={creatingCollection}
                            maxLength={30}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--surface-2)',
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            type="button"
                            onClick={() => setShowNewCollectionDialog(false)}
                            className="bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={creatingCollection || !newCollectionName.trim()}
                            className="bg-[#808bf5] text-white border-0 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                            {creatingCollection ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </Dialog>

            <Toaster />
        </>
    );
};

export default Profile;
