import React, { useState } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useUserPosts, useSavedPosts } from '../../hooks/queries/usePostQueries';
import { useQuery } from '@tanstack/react-query';
import { useFollowUser, useUnfollowUser, authKeys, useCollabInvites } from '../../hooks/queries/useAuthQueries';
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
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;


    const loggeduser = useAuthStore(s => s.user);

    const blockUser = useAuthStore(s => s.blockUser);
    const unblockUser = useAuthStore(s => s.unblockUser);
    const muteUser = useAuthStore(s => s.muteUser);
    const unmuteUser = useAuthStore(s => s.unmuteUser);

    // Determine whose profile to show
    const viewingOwnProfile = !userId || loggeduser?._id === userId;
    const profileId = userId || loggeduser?._id;

    // Fetch own posts/saved
    const { data: userPosts = [], isLoading: loadingUserPosts } = useUserPosts(profileId);
    const { data: savedPostsData = [] } = useSavedPosts(viewingOwnProfile ? profileId : null);
    const userPostsList = userPosts?.pages?.flatMap(p => p.posts) || [];
    const savedPosts = savedPostsData || [];

    // Fetch other user's profile data if viewing someone else
    const { data: otherUserProfile, isLoading: otherUserLoading } = useQuery({
        queryKey: authKeys.userProfile(profileId),
        queryFn: async () => {
            const res = await api.get(`/api/auth/other-user/view/${profileId}`);
            return res.data;
        },
        enabled: !viewingOwnProfile && !!profileId && !!loggeduser?._id,
        staleTime: 1000 * 60 * 2
    });

    // Follow/Unfollow mutations
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    const displayUser = viewingOwnProfile ? loggeduser : otherUserProfile;
    const isFollowing = loggeduser?.following?.some(f => f?.toString() === profileId?.toString());
    const isBlockedByMe = loggeduser?.blockedUsers?.some(b => b?.toString() === profileId?.toString());
    const isMuted = loggeduser?.mutedUsers?.some(m => m?.toString() === profileId?.toString());
    const isPrivateAndNotFollowing = displayUser?.isPrivate && !isFollowing && !viewingOwnProfile && !isBlockedByMe;

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

    const handleUnfollow = () => unfollowMutation.mutate({ targetUserId: profileId });


    const handleBlock = () => {
        confirmDialog({
            message: `Block ${displayUser.fullname}? They won't be able to see your posts or message you.`,
            header: 'Block User',
            icon: 'pi pi-ban',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Yes, Block',
            rejectLabel: 'Cancel',
            accept: () => {
                blockUser(profileId);
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
                unblockUser(profileId);
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
                    unmuteUser(profileId);
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
                    muteUser(profileId);
                    toast.success(`Muted ${displayUser.fullname}`);
                },
            });
        }
    };

    const { data: collabInvites = [] } = useCollabInvites(viewingOwnProfile ? profileId : null);

    if (!loggeduser) return <div className="text-center p-4">Loading...</div>;
    if (!viewingOwnProfile && otherUserLoading) return <div className="text-center p-4">Loading profile...</div>;
    if (!displayUser) return <div className="text-center p-4">Profile not found</div>;

    const pendingCollabCount = collabInvites.length;

    // Only posts/saved use the grid
    const tabPosts = activeTab === 'posts' ? userPostsList : savedPosts;
    const isLoadingTab = activeTab === 'posts' ? loadingUserPosts : false;

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    // Tabs: own profile shows Posts/Saved/Collabs, other profiles show Posts only
    const TABS = viewingOwnProfile
        ? [
            { key: 'posts', label: `Posts (${userPostsList.length})` },
            { key: 'saved', label: `Saved (${savedPosts.length})` },
            {
                key: 'collabs',
                label: (
                    <div className="flex items-center justify-center gap-1.5">
                        <span>🤝 Collabs</span>
                        {pendingCollabCount > 0 && (
                            <span className="bg-[#ef4444] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                                {pendingCollabCount}
                            </span>
                        )}
                    </div>
                )
            },
            { key: 'analytics', label: '📊 Insights' },
        ]
        : [

        ];

    return (
        <>
            <div className="w-full max-w-xl lg:max-w-xl xl:max-w-lg 2xl:max-w-xl mx-auto">
                <div className="bg-[var(--surface-1)] flex flex-col gap-4 min-h-screen">

                    {/* Header: Sticky Profile Info */}
                    <div className="sticky top-0 z-30 bg-[var(--surface-1)] bg-opacity-90 backdrop-blur-md py-2 px-4 sm:py-0 sm:px-0 sm:mx-0 sm:px-0">
                        {/* Avatar + identity */}
                        <div className="flex items-center justify-center text-center flex-col gap-1 mb-4">
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
                                {viewingOwnProfile && (
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
                        </div>

                        {/* Level/Streak/XP */}
                        {!isPrivateAndNotFollowing && !isBlockedByMe && (
                            <div className="flex gap-3 justify-center mb-4">
                                <div className="flex flex-col items-center bg-[var(--surface-2)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] min-w-[70px]">
                                    <span className="text-[9px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Level</span>
                                    <span className="text-lg font-black text-[#808bf5]">{displayUser?.level || 1}</span>
                                </div>
                                <div className="flex flex-col items-center bg-[var(--surface-2)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] min-w-[70px]">
                                    <span className="text-[9px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Streak</span>
                                    <span className="text-lg font-black text-orange-500">🔥 {displayUser?.streak?.count || 0}</span>
                                </div>
                                <div className="flex flex-col items-center bg-[var(--surface-2)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] min-w-[70px]">
                                    <span className="text-[9px] uppercase font-bold text-[var(--text-sub)] tracking-wider">XP</span>
                                    <span className="text-lg font-black text-green-500">{(displayUser?.xp || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Stats tiles */}
                        {!isPrivateAndNotFollowing && !isBlockedByMe && (
                            <div className="grid grid-cols-4 gap-1 sm:gap-3 mb-4">
                                <div
                                    className={`rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center transition-all px-1 sm:px-4 cursor-pointer ${viewingOwnProfile || isFollowing ? 'cursor-pointer hover:bg-[var(--surface-1)] active:scale-95' : 'opacity-60 cursor-not-allowed'}`}
                                    onClick={() => {
                                        if (viewingOwnProfile || isFollowing) {
                                            setShowFollowersList(true);
                                        } else {
                                            toast.error('Follow this user to see their followers', { icon: '🔒' });
                                        }
                                    }}
                                >
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center">{formatCount(displayUser?.followers?.length || 0)}</h6>
                                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Followers</span>
                                </div>
                                <div
                                    className={`rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center transition-all px-1 sm:px-4 ${viewingOwnProfile || isFollowing ? 'cursor-pointer hover:bg-[var(--surface-1)] active:scale-95' : 'opacity-60 cursor-not-allowed'}`}
                                    onClick={() => {
                                        if (viewingOwnProfile || isFollowing) {
                                            setShowFollowingList(true);
                                        } else {
                                            toast.error('Follow this user to see who they follow', { icon: '🔒' });
                                        }
                                    }}
                                >
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center ">{formatCount(displayUser?.following?.length || 0)}</h6>
                                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block" style={{ whiteSpace: 'nowrap' }}>Following</span>
                                </div>
                                <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-2 sm:py-3 text-center cursor-pointer px-1 sm:px-4">
                                    <h6 className="m-0 font-extrabold text-sm sm:text-base leading-5 text-[var(--text-main)] text-center">{formatCount(userPostsList.length)}</h6>
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
                            {viewingOwnProfile ? (
                                <></>
                            ) : !isBlockedByMe && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={isFollowing ? handleUnfollow : handleFollow}
                                        disabled={followMutation.isPending || unfollowMutation.isPending}
                                        className={`h-10 sm:h-11 lg:h-12 rounded-xl border font-semibold text-sm cursor-pointer transition ${isFollowing
                                            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'
                                            : 'border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-95 shadow-lg shadow-indigo-500/20'}`}
                                    >
                                        {followMutation.isPending || unfollowMutation.isPending ? '...' : (isFollowing ? 'Following' : 'Follow')}
                                    </button>
                                    <button
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 font-semibold text-sm cursor-pointer hover:bg-indigo-500/20 transition flex items-center justify-center gap-2"
                                    >
                                        <i className="pi pi-send"></i>
                                        <span>Message</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* OTHER PROFILE - Mute/Block Options */}
                        {!viewingOwnProfile && (
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
                            <div className="flex">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex-1 py-2.5 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${activeTab === tab.key ? 'text-indigo-600' : 'text-[var(--text-sub)]'
                                            }`}
                                        style={{ borderBottom: activeTab === tab.key ? '2px solid #808bf5' : '2px solid transparent' }}
                                    >
                                        {tab.label}
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
                            <p className="m-0 text-sm text-[var(--text-sub)]">Follow to see their photos and videos.</p>
                        </div>
                    ) : activeTab === 'collabs' ? (
                        // Collabs tab — full width, no grid
                        <CollabManager mode="all" />
                    ) : activeTab === 'analytics' ? (
                        // Analytics tab
                        <div className="px-4">
                            <CreatorAnalytics userId={profileId} />
                        </div>
                    ) : (
                        // Posts / Saved — 3-col grid   
                        <div className="grid grid-cols-3 gap-2 pr-1">
                            {isLoadingTab ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ aspectRatio: '1' }} />
                                ))
                            ) : tabPosts.length > 0 ? (
                                (viewingOwnProfile || isFollowing ? tabPosts : tabPosts.slice(0, 3)).map(post => (
                                    <PostCard
                                        key={post._id}
                                        post={post}
                                        isBlur={!(viewingOwnProfile || isFollowing)}
                                        onClick={(post) => {
                                            if (viewingOwnProfile || isFollowing) {
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
                                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                        <div className="relative w-full mb-8">
                                            <div className="grid grid-cols-3 gap-3 opacity-5">
                                                {[1, 2, 3, 4, 5, 6].map(i => (
                                                    <div key={i} className="bg-[var(--surface-2)] rounded-lg animate-pulse" style={{ aspectRatio: '1' }} />
                                                ))}
                                            </div>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 bg-[var(--surface-1)] rounded-full flex items-center justify-center shadow-lg mb-4 border border-[var(--border-color)]">
                                                    <i className="pi pi-images text-3xl text-[var(--text-sub)] opacity-20"></i>
                                                </div>
                                                <h3 className="m-0 text-[var(--text-main)] font-bold text-lg">
                                                    {activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}
                                                </h3>
                                                <p className="m-0 text-sm text-[var(--text-sub)] mt-1 max-w-[200px]">
                                                    {activeTab === 'posts'
                                                        ? "This user hasn't shared anything yet."
                                                        : "Posts you save will appear here."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Edit & Security Dialogs - Own Profile Only */}
            {viewingOwnProfile && (
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
                <FollowFollowingList isfollowing={false} ids={displayUser?.followers} />
            </Dialog>
            <Dialog
                header="Following"
                visible={showFollowingList}
                style={{ width: '90vw', maxWidth: '420px', height: '80vh' }}
                onHide={() => setShowFollowingList(false)}
                className="rounded-3xl"
            >
                <FollowFollowingList isfollowing={true} ids={displayUser?.following} />
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

            <Toaster />
        </>
    );
};

export default Profile;