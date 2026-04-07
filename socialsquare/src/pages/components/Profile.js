import { useState } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useUserPosts, useSavedPosts } from '../../hooks/queries/usePostQueries';
import { useQuery } from '@tanstack/react-query';
import { useFollowUser, useUnfollowUser } from '../../hooks/queries/useAuthQueries';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import toast, { Toaster } from 'react-hot-toast';
import { socket } from '../../socket';
import EditProfile from './EditProfile';
import ActiveSessions from './ActiveSessions';
import FollowFollowingList from './FollowFollowingList';
import CollabManager from './CollabManager';
import PostCard from './ui/PostCard';
import PostDetail from './PostDetail';

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

    const loggeduser = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);
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
        queryKey: ['user', 'profile', profileId],
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

    const handleLogout = () => {
        confirmDialog({
            message: 'Are you sure you want to logout?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                localStorage.removeItem('token');
                sessionStorage.removeItem('hasReloaded');
                logout();
                toast.error('You have been logged out.');
                if (socket.connected) socket.emit('logoutUser', loggeduser?._id);
                window.location.href = '/login';
            },
            reject: () => toast.error('Logout canceled.'),
        });
    };

    const handleDeleteProfile = () => {
        confirmDialog({
            message: 'Are you sure you want to delete your profile? This action cannot be undone.',
            header: 'Delete Profile',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.delete('/api/auth/profile/delete');
                    toast.success('Profile deleted');
                    logout();
                    window.location.href = '/login';
                } catch {
                    toast.error('Failed to delete profile');
                }
            },
        });
    };

    const handleBlock = () => {
        if (window.confirm(`Block ${displayUser.fullname}? They won't be able to see your posts or message you.`)) {
            blockUser(profileId);
            toast.success(`Blocked ${displayUser.fullname}`);
        }
    };

    const handleUnblock = () => {
        unblockUser(profileId);
        toast.success(`Unblocked ${displayUser.fullname}`);
    };

    const handleMute = () => {
        if (isMuted) {
            unmuteUser(profileId);
            toast.success(`Unmuted ${displayUser.fullname}`);
        } else {
            muteUser(profileId);
            toast.success(`Muted ${displayUser.fullname}`);
        }
    };

    if (!loggeduser) return <div className="text-center p-4">Loading...</div>;
    if (!viewingOwnProfile && otherUserLoading) return <div className="text-center p-4">Loading profile...</div>;
    if (!displayUser) return <div className="text-center p-4">Profile not found</div>;

    // Only posts/saved use the grid — collabs has its own renderer
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
            { key: 'collabs', label: '🤝 Collabs' },
        ]
        : [

        ];

    return (
        <>
            <div className="w-full max-w-xl lg:max-w-xl xl:max-w-lg 2xl:max-w-xl mx-auto">
                <div className="bg-[var(--surface-1)] flex flex-col gap-4 min-h-screen">

                    {/* Header: Sticky Profile Info */}
                    <div className="sticky top-0 z-30 bg-[var(--surface-1)] bg-opacity-90 backdrop-blur-md border-b border-[var(--border-color)] py-2 px-4 sm:mx-0 sm:px-0">
                        {/* Avatar + identity */}
                        <div className="flex items-center justify-center text-center flex-col gap-1 mb-4">
                            <div className="relative">
                                <Image
                                    src={displayUser?.profile_picture}
                                    zoomSrc={displayUser?.profile_picture}
                                    alt="Profile"
                                    className="profile-image-square overflow-hidden border-4 border-indigo-100"
                                    style={{ '--size': '80px' }}
                                    preview
                                />
                                {viewingOwnProfile && (
                                    <button
                                        className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-0 cursor-pointer bg-[#4f46e5] text-white flex items-center justify-center"
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

                        {/* Stats tiles */}
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mb-4">
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center cursor-pointer"
                                onClick={() => viewingOwnProfile && setShowFollowersList(true)}>
                                <h6 className="m-0 font-extrabold text-base leading-5 text-[var(--text-main)]">{formatCount(displayUser?.followers?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Followers</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center cursor-pointer"
                                onClick={() => viewingOwnProfile && setShowFollowingList(true)}>
                                <h6 className="m-0 font-extrabold text-base leading-5 text-[var(--text-main)]">{formatCount(displayUser?.following?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Following</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center">
                                <h6 className="m-0 font-extrabold text-base leading-5 text-[var(--text-main)]">{formatCount(userPostsList.length)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Posts</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center" title="Total profile views">
                                <h6 className="m-0 font-extrabold text-base leading-5 text-[var(--text-main)]">{formatCount(displayUser?.profileViews || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Views</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mb-4">
                            {viewingOwnProfile ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm cursor-pointer hover:bg-indigo-100 transition"
                                        onClick={() => setEditVisible(true)}
                                    >
                                        <i className="pi pi-user-edit mr-2"></i>Edit Profile
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm cursor-pointer hover:opacity-95 transition"
                                    >
                                        <i className="pi pi-sign-out mr-2"></i>Logout
                                    </button>
                                </div>
                            ) : !isBlockedByMe && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={isFollowing ? handleUnfollow : handleFollow}
                                        disabled={followMutation.isPending || unfollowMutation.isPending}
                                        className={`h-10 sm:h-11 lg:h-12 rounded-xl border font-semibold text-sm cursor-pointer transition ${isFollowing ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-95'}`}
                                    >
                                        {followMutation.isPending || unfollowMutation.isPending ? '...' : (isFollowing ? 'Following' : 'Follow')}
                                    </button>
                                    <button
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm cursor-pointer hover:bg-indigo-100 transition"
                                    >
                                        <i className="pi pi-send mr-2"></i>Message
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
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
                    </div>

                    {/* Tab content */}
                    {activeTab === 'collabs' ? (
                        // Collabs tab — full width, no grid
                        <CollabManager mode="all" />
                    ) : (
                        // Posts / Saved — 3-col grid   
                        <div className="grid grid-cols-3 gap-2 pr-1">
                            {isLoadingTab ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ aspectRatio: '1' }} />
                                ))
                            ) : tabPosts.length > 0 ? (
                                tabPosts.map(post => <PostCard key={post._id} post={post} onClick={(post) => { setPostDetail(post); setPostDetailVisible(true); }} />)
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

                    {/* OTHER PROFILE - Mute/Block Options */}
                    {!viewingOwnProfile && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 text-center">
                            <button
                                onClick={handleMute}
                                className="flex-1 text-xs text-gray-500 hover:text-orange-500 transition border-0 bg-transparent cursor-pointer font-medium"
                            >
                                <i className={`pi ${isMuted ? 'pi-volume-up' : 'pi-volume-off'} mr-1`}></i>
                                {isMuted ? 'Unmute' : 'Mute'}
                            </button>
                            {!isBlockedByMe && (
                                <button
                                    onClick={handleBlock}
                                    className="flex-1 text-xs text-gray-500 hover:text-red-500 transition border-0 bg-transparent cursor-pointer font-medium"
                                >
                                    <i className="pi pi-ban mr-1"></i>Block
                                </button>
                            )}
                            {isBlockedByMe && (
                                <button
                                    onClick={handleUnblock}
                                    className="flex-1 text-xs text-red-600 border-0 bg-transparent cursor-pointer font-medium hover:text-red-700 transition"
                                >
                                    <i className="pi pi-check mr-1"></i>Unblock
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog />

            {/* OWN PROFILE - Edit & Security Dialogs */}
            {viewingOwnProfile && (
                <>
                    <Dialog header="Edit Profile" visible={editVisible} position="center" style={{ width: '90vw', maxWidth: '500px', height: '80vh' }} onHide={() => setEditVisible(false)}>
                        <EditProfile users={loggeduser} closeSidebar={() => setEditVisible(false)} />
                    </Dialog>
                    <Dialog header="Security & Sessions" visible={activeSessionsVisible} position="center" style={{ width: '90vw', maxWidth: '500px', height: '100vh' }} onHide={() => setActiveSessionsVisible(false)}>
                        <ActiveSessions />
                    </Dialog>
                    <Dialog header="Followers" visible={showFollowersList} style={{ width: '90vw', maxWidth: '500px', height: '80vh' }} onHide={() => setShowFollowersList(false)}>
                        <FollowFollowingList isfollowing={false} ids={loggeduser?.followers} />
                    </Dialog>
                    <Dialog header="Following" visible={showFollowingList} style={{ width: '90vw', maxWidth: '500px', height: '80vh' }} onHide={() => setShowFollowingList(false)}>
                        <FollowFollowingList isfollowing={true} ids={loggeduser?.following} />
                    </Dialog>
                </>
            )}



            {/* Post Detail Dialog - Shared */}
            <Dialog
                header="Post Detail"
                visible={postDetailVisible}
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                onHide={() => setPostDetailVisible(false)}
                modal
                className="p-0 overflow-hidden post-detail-dialog"
            >
                <PostDetail post={postDetail} onHide={() => setPostDetailVisible(false)} />
            </Dialog>

            <Toaster />
        </>
    );
};

export default Profile;