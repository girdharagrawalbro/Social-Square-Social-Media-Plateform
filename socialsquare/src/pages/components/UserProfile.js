import React, { useState, lazy, Suspense } from "react";
import { useNavigate } from 'react-router-dom';
import { Image } from "primereact/image";
import { Dialog } from "primereact/dialog";
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useCreateConversation } from '../../hooks/queries/useConversationQueries';
import { useUserDetails, useFollowUser, useUnfollowUser } from '../../hooks/queries/useAuthQueries';
import { useUserPosts } from '../../hooks/queries/usePostQueries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChatPanel from './ChatPanel';
import CreatorAnalytics from './CreatorAnalytics';
import toast from 'react-hot-toast';

const PostDetail = lazy(() => import('./PostDetail'));

/**
 * UserProfile Component
 * 
 * ✅ POPUP/DIALOG MODE (compact=true, DEFAULT):
 *    - Used in Search results dialog
 *    - Minimal card-like UI with rounded borders & shadow
 *    - Shows only Posts tab
 *    - Limits posts to 3 items (maxPosts={3})
 *    - Hides Level/Streak/XP, Followers/Following tabs, Analytics
 *    - Compact size (max-w-sm)
 * 
 * ✅ FULL PAGE MODE (compact=false):
 *    - Used in ProfilePage (/profile/:userId route)
 *    - Full width layout (max-w-4xl)
 *    - Shows all tabs and details
 *    - Shows Level/Streak/XP badges
 *    - Shows Followers/Following counts
 *    - Shows analytics if user is creator
 *    - No visual borders/shadow (cleaner for page)
 */


const PostGrid = ({ userId, maxPosts = 3, isCompactPreview = true }) => {
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [postDetail, setPostDetail] = useState(null);

    const {
        data,
        isLoading
    } = useUserPosts(userId);

    const allPosts = data?.pages.flatMap(page => page.posts) || [];
    const posts = maxPosts ? allPosts.slice(0, maxPosts) : allPosts;

    if (isLoading && posts.length === 0) return (
        <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-[var(--surface-2)] rounded-lg animate-pulse" style={{ aspectRatio: '1' }} />)}
        </div>
    );

    if (posts.length === 0) return <p className="text-center text-[var(--text-sub)] text-sm py-6">No posts yet</p>;

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                {posts.map((post, idx) => {
                    const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                    return (
                        <div
                            key={post._id}
                            onClick={() => { setPostDetail(post); setPostDetailVisible(true); }}
                            className={`relative rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer hover:opacity-90 transition group opacity-65`}
                            style={{ aspectRatio: '1' }}
                        >
                            {imgs[0]
                                ? <img src={imgs[0]} alt="" className='w-full h-full object-cover blur-sm ' />
                                : <div className={`w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)] p-2 text-center blur-sm`}>{post.caption?.slice(0, 30)}</div>
                            }
                            {/* {imgs.length > 1 && (
                                <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-1">
                                    <i className="pi pi-images text-white" style={{ fontSize: '12px' }}></i>
                                </div>
                            )} */}
                            {/* <div className="absolute bottom-0 left-0 right-0 flex gap-3 px-2 py-2 opacity-0 group-hover:opacity-100 transition" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                                <span className="text-white text-xs font-semibold">❤️ {post.likes?.length || 0}</span>
                                <span className="text-white text-xs font-semibold">💬 {post.comments?.length || 0}</span>
                            </div> */}
                        </div>
                    );
                })}
            </div>

            <Dialog
                header="Post Detail"
                visible={postDetailVisible}
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                onHide={() => setPostDetailVisible(false)}
                modal
                className="p-0 overflow-hidden post-detail-dialog"
            >
                <Suspense fallback={<div className="p-4 text-center">Loading Post Details...</div>}>
                    <PostDetail post={postDetail} onHide={() => setPostDetailVisible(false)} />
                </Suspense>
            </Dialog>
        </>
    );
};

const UserProfile = ({ id }) => {
    const [activeTab, setActiveTab] = useState('posts');
    const [chatVisible, setChatVisible] = useState(false);
    const loggeduser = useAuthStore(s => s.user);
    const blockUser = useAuthStore(s => s.blockUser);
    const unblockUser = useAuthStore(s => s.unblockUser);
    const muteUser = useAuthStore(s => s.muteUser);
    const unmuteUser = useAuthStore(s => s.unmuteUser);

    const createConvMutation = useCreateConversation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    const { data: userDetails, isLoading: userLoading } = useQuery({
        queryKey: ['user', 'profile', id],
        queryFn: async () => {
            const res = await api.get(`/api/auth/other-user/view/${id}`);
            return res.data;
        },
        enabled: !!id && !!loggeduser?._id,
        staleTime: 1000 * 60 * 2
    });

    const followersList = useUserDetails(userDetails?.followers?.length > 0 ? userDetails.followers : null).data || [];
    const followingList = useUserDetails(userDetails?.following?.length > 0 ? userDetails.following : null).data || [];

    // posts count for compact preview tiles
    const { data: postsData } = useUserPosts(id);
    const userPostsList = postsData?.pages?.flatMap(p => p.posts) || [];

    const isFollowing = loggeduser?.following?.some(f => f?.toString() === id?.toString());
    const isRequested = userDetails?.followRequests?.some(r => r?.toString() === loggeduser?._id?.toString());
    const isBlockedByMe = loggeduser?.blockedUsers?.some(b => b?.toString() === id?.toString());
    const isMuted = loggeduser?.mutedUsers?.some(m => m?.toString() === id?.toString());
    const isPrivateAndNotFollowing = userDetails?.isPrivate && !isFollowing && loggeduser?._id !== id && !isBlockedByMe;

    const handleFollow = async () => {
        try {
            const res = await followMutation.mutateAsync({ targetUserId: id });
            if (res.requested) {
                queryClient.setQueryData(['user', 'profile', id], prev => ({
                    ...prev,
                    followRequests: [...(prev.followRequests || []), loggeduser._id]
                }));
                toast.success('Follow request sent');
            }
        } catch (err) {
            toast.error('Failed to send follow request');
        }
    };
    const handleUnfollow = () => unfollowMutation.mutate({ targetUserId: id });

    const handleMessage = async () => {
        try {
            await createConvMutation.mutateAsync(id);
            setChatVisible(true);
        } catch {
            toast.error('Unable to start conversation');
        }
    };

    const handleBlock = () => { if (window.confirm(`Block ${userDetails.fullname}? They won't be able to see your posts or message you.`)) blockUser(id); };
    const handleUnblock = () => unblockUser(id);
    const handleMute = () => isMuted ? unmuteUser(id) : muteUser(id);

    const handleShareProfile = async () => {
        const profileUrl = `${window.location.origin}/profile/${id}`;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `${userDetails?.fullname || 'User'} on Social Square`,
                    text: `Check out this profile on Social Square`,
                    url: profileUrl
                });
                return;
            }
            await navigator.clipboard.writeText(profileUrl);
            toast.success('Profile link copied');
        } catch {
            toast.error('Unable to share profile right now');
        }
    };

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    if (!id) return null;
    if (userLoading) return (
        <div className={`w-full p-4`}>
            <div className={`flex flex-col gap-6 items-center bg-[var(--surface-1)] p-8 `}>
                <div className="w-24 h-24 rounded-full bg-[var(--surface-2)] animate-pulse" />
                <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-40 bg-[var(--surface-2)] rounded animate-pulse" />
                    <div className="h-4 w-28 bg-[var(--surface-2)] rounded animate-pulse" />
                </div>
            </div>
        </div>
    );
    if (!userDetails) return <p className="text-center text-[var(--text-sub)] p-4">User not found</p>;



    return (
        <>
            {/* 
            USAGE:
            - Popup/Dialog (compact=true): Shows in PrimeReact Dialog, minimal UI, 3 posts max
            - Page Display (compact=false): Full profile page at /profile/:userId, complete UI, all posts
            */}
            <div className={`w-full py-2`}>
                <div className={`flex flex-col gap-4 bg-[var(--surface-1)]`}>
                    <div className="flex items-center justify-center text-center flex-col gap-1">
                        <div className="relative">
                            <Image
                                src={userDetails?.profile_picture}
                                zoomSrc={userDetails?.profile_picture}
                                alt="Profile"
                                className="profile-image-square overflow-hidden border-4 border-[var(--border-color)]"
                                style={{ '--size': '80px' }}
                                preview
                            />
                        </div>
                        <h3 className="m-0 text-lg sm:text-xl lg:text-2xl font-semibold text-[var(--text-main)] flex items-center gap-2 justify-center">
                            {userDetails?.fullname}
                            {userDetails?.isVerified && <i className="pi pi-check-circle text-blue-500" style={{ fontSize: '18px' }}></i>}
                        </h3>
                        <div className="flex items-center gap-2">
                            {userDetails?.username && (
                                <p className="m-0 text-sm font-medium text-[#808bf5]">@{userDetails.username}</p>
                            )}
                            {userDetails?.creatorTier && userDetails.creatorTier !== 'none' && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    {userDetails.creatorTier} Tier
                                </span>
                            )}
                        </div>
                        {userDetails?.bio && (
                            <p className="text-sm text-[var(--text-main)] m-0 max-w-[260px] leading-6">{userDetails.bio}</p>
                        )}



                        {userDetails?.mutualFollowers?.length > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex -space-x-2">
                                    {userDetails.mutualFollowers.slice(0, 3).map((m, idx) => (
                                        <img
                                            key={m._id}
                                            src={m.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.fullname || 'U')}&background=808bf5&color=fff`}
                                            alt={m.fullname}
                                            className="w-6 h-6 rounded-full border-2 border-[var(--surface-1)] object-cover"
                                            style={{ zIndex: 3 - idx }}
                                        />
                                    ))}
                                </div>
                                <p className="text-[11px] text-[var(--text-sub)] m-0">
                                    Followed by <strong>{userDetails.mutualFollowers[0]?.fullname || 'someone you know'}</strong>
                                    {userDetails.mutualCount > 1 ? ` and ${userDetails.mutualCount - 1} other${userDetails.mutualCount > 2 ? 's' : ''}` : ''}
                                </p>
                            </div>
                        )}
                    </div>

                    {loggeduser?._id !== id && (
                        <div className="flex flex-col gap-4">
                            {!isBlockedByMe ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={isFollowing ? handleUnfollow : handleFollow}
                                        disabled={(isRequested && !isFollowing) || followMutation.isPending || unfollowMutation.isPending}
                                        className={`h-10 sm:h-11 lg:h-12 rounded-xl border font-semibold text-sm cursor-pointer transition ${isFollowing ? 'border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] hover:bg-[var(--surface-1)]' : isRequested ? 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)] cursor-default' : 'border-0 bg-[#808bf5] text-white hover:opacity-95'}`}
                                    >
                                        {((followMutation.isPending && followMutation.variables?.targetUserId === id) || (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === id))
                                            ? '...'
                                            : (isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow')}
                                    </button>
                                    <button
                                        onClick={handleMessage}
                                        className="h-10 sm:h-11 lg:h-12 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] font-semibold text-sm cursor-pointer hover:bg-[var(--surface-1)] transition"
                                    >
                                        <i className="pi pi-send mr-2"></i>Message
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleUnblock}
                                    className="w-full h-10 rounded-xl bg-red-100 text-red-600 border border-red-200 font-bold text-sm cursor-pointer hover:bg-red-200 transition"
                                >
                                    Unblock {userDetails.fullname}
                                </button>
                            )}

                            {/* {!isBlockedByMe && (
                                <div className="flex items-center justify-center gap-4 py-1">
                                    <button onClick={handleMute} className="text-xs text-[var(--text-sub)] hover:text-orange-500 transition border-0 bg-transparent cursor-pointer font-medium">
                                        <i className={`pi ${isMuted ? 'pi-volume-up' : 'pi-volume-off'} mr-1`}></i>
                                        {isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                    <button onClick={handleBlock} className="text-xs text-[var(--text-sub)] hover:text-red-500 transition border-0 bg-transparent cursor-pointer font-medium">
                                        <i className="pi pi-ban mr-1"></i>
                                        Block
                                    </button>
                                </div>
                            )} */}
                            <button
                                onClick={handleShareProfile}
                                className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] font-semibold text-sm cursor-pointer hover:bg-[var(--surface-1)] transition"
                            >
                                🔗 Share Profile
                            </button>
                        </div>
                    )}

                    {/* Compact popup: show 4 stat tiles (Followers/Following/Posts/Views) */}
                    {!isBlockedByMe && (
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mt-2">
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center cursor-pointer"
                            >
                                <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userDetails?.followers?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Followers</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center cursor-pointer"
                            >
                                <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userDetails?.following?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Following</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center">
                                <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userPostsList.length)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Posts</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center" title="Total profile views">
                                <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userDetails?.profileViews || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Views</span>
                            </div>
                        </div>
                    )}

                    {loggeduser?._id === id && (
                        <button
                            onClick={handleShareProfile}
                            className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] font-semibold text-sm cursor-pointer hover:bg-[var(--surface-1)] transition"
                        >
                            🔗 Share Profile
                        </button>
                    )}

                    {!isBlockedByMe && (
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center">
                                <h6 className="m-0 font-extrabold text-base text-[var(--text-main)] leading-5">{formatCount(userDetails?.followers?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold">Followers</span>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center">
                                <h6 className="m-0 font-extrabold text-base text-[var(--text-main)] leading-5">{formatCount(userDetails?.following?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold">Following</span>
                            </div>
                        </div>
                    )}

                    {/* Posts Preview in Compact Mode - ABOVE TABS */}
                    { !isBlockedByMe && (
                        <div className="flex flex-col gap-2">
                            <PostGrid userId={id} maxPosts={3} isCompactPreview={true} />
                            <button onClick={() => navigate(`/profile/${id}`)} className="w-full h-9 text-sm font-semibold text-white bg-[#808bf5] hover:opacity-95 transition rounded-lg border-0 cursor-pointer">
                                View full profile
                            </button>
                        </div>
                    )}

                    {/* {!isBlockedByMe && (
                        <div className="flex border-b border-[var(--border-color)]">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 py-2.5 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${activeTab === tab.key ? 'text-[#808bf5]' : 'text-[var(--text-sub)]'}`}
                                    style={{ borderBottom: activeTab === tab.key ? '2px solid #808bf5' : '2px solid transparent' }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )} */}

                    <div>
                        {isBlockedByMe ? (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[var(--surface-2)] rounded-3xl border border-red-50">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                    <i className="pi pi-ban text-3xl text-red-500"></i>
                                </div>
                                <h3 className="m-0 text-[var(--text-main)] font-black text-xl mb-2">User Blocked</h3>
                                <p className="m-0 text-sm text-[var(--text-sub)] max-w-[200px] leading-relaxed">
                                    You have blocked this user. Unblock them to see their posts and profile details.
                                </p>
                            </div>
                        ) : isPrivateAndNotFollowing ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--surface-2)] rounded-2xl border border-dashed border-[var(--border-color)]">
                                <div className="w-16 h-16 bg-[var(--surface-1)] rounded-full flex items-center justify-center shadow-sm mb-4">
                                    <i className="pi pi-lock text-2xl text-[var(--text-sub)]"></i>
                                </div>
                                <h4 className="m-0 text-[var(--text-main)] font-bold mb-1">This Account is Private</h4>
                                <p className="m-0 text-sm text-[var(--text-sub)]">Follow this account to see their posts and stories.</p>
                            </div>
                        ) : (
                            <>
                                {/* {activeTab === 'posts' && <PostGrid userId={id} maxPosts={compact ? 3 : undefined} />}

                                {activeTab === 'followers' && (
                                    <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                                        {userDetails.followers?.length === 0 ? (
                                            <p className="text-center text-[var(--text-sub)] text-sm py-4">No followers yet</p>
                                        ) : (
                                            followersList.map(user => (
                                                <div key={user._id} className="flex items-center gap-3 p-2 bg-[var(--surface-2)] rounded-lg">
                                                    <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <p className="m-0 text-sm font-semibold text-[var(--text-main)] truncate">{user.fullname}</p>
                                                            {user.isVerified && <i className="pi pi-check-circle text-blue-500" style={{ fontSize: '11px' }}></i>}
                                                        </div>
                                                        {user.username && <p className="m-0 text-[11px] text-[#808bf5]">@{user.username}</p>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )} */}

                                {/* {activeTab === 'following' && (
                                    <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                                        {userDetails.following?.length === 0 ? (
                                            <p className="text-center text-[var(--text-sub)] text-sm py-4">Not following anyone yet</p>
                                        ) : (
                                            followingList.map(user => (
                                                <div key={user._id} className="flex items-center gap-3 p-2 bg-[var(--surface-2)] rounded-lg">
                                                    <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="m-0 text-sm font-semibold text-[var(--text-main)] truncate">{user.fullname}</p>
                                                        {user.username && <p className="m-0 text-[11px] text-[#808bf5]">@{user.username}</p>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )} */}

                                {/* {activeTab === 'analytics' && loggeduser?._id === id && (
                                    <CreatorAnalytics userId={id} />
                                )} */}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Dialog header={`Chat with ${userDetails.fullname}`} visible={chatVisible}
                style={{ width: '95vw', maxWidth: '500px', height: '90vh' }} position="center" onHide={() => setChatVisible(false)}>
                <ChatPanel participantId={id} />
            </Dialog>
        </>
    );
};

export default UserProfile;