import React, { useState, lazy } from "react";
import { useNavigate } from 'react-router-dom';
import { Image } from "primereact/image";
import { Dialog } from "primereact/dialog";
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useCreateConversation } from '../../hooks/queries/useConversationQueries';
import { useUserDetails, useFollowUser, useUnfollowUser, authKeys } from '../../hooks/queries/useAuthQueries';
import { useUserPosts } from '../../hooks/queries/usePostQueries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChatPanel from './ChatPanel';

import toast from 'react-hot-toast';

const PostDetail = lazy(() => import('./PostDetail'));

const PostGrid = ({ userId, maxPosts, isBlur }) => {
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

    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center ">
                <div className="relative w-full mb-6    ">

                    <div className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-[var(--surface-1)] rounded-full flex items-center justify-center shadow-lg mb-4 border border-[var(--border-color)]">
                            <i className="pi pi-images text-4xl text-[var(--text-sub)] opacity-20"></i>
                        </div>
                        <h3 className="m-0 text-[var(--text-main)] font-bold text-lg">No posts yet</h3>
                        <p className="m-0 text-sm text-[var(--text-sub)] mt-1 max-w-[200px]">When this user shares photos or videos, they'll appear here.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                {posts.map((post, idx) => {
                    const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                    return (
                        <div
                            key={post._id}

                            onClick={() => { setPostDetail(post); setPostDetailVisible(isBlur ? false : true); }}
                            className={`relative rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer hover:opacity-90 transition group ${isBlur ? 'blur-sm' : ''}`}
                            style={{ aspectRatio: '1' }}
                        >
                            {imgs[0]
                                ? <img src={imgs[0]} alt="" className={`w-full h-full object-cover  ${isBlur ? 'blur-sm' : ''}`} />
                                : <div className={`w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)] p-2 text-center ${isBlur ? 'blur-sm' : ''}`}>{post.caption?.slice(0, 30)}</div>
                            }
                        </div>
                    );
                })}
            </div>

            <Dialog
                showHeader={false}
                visible={postDetailVisible}
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                onHide={() => setPostDetailVisible(false)}
                contentStyle={{ padding: 0, borderRadius: '24px', overflow: 'hidden', background: 'transparent' }}
                baseZIndex={20000}
                dismissableMask
                blockScroll={true}
                closable={false}
            >
                <div className="relative bg-[var(--surface-1)] h-full w-full" style={{ borderRadius: '24px', overflow: 'hidden' }}>
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
            </Dialog >
        </>
    );
};

const UserProfile = ({ id, onClose, maxPosts }) => {

    const [chatVisible, setChatVisible] = useState(false);
    const [followersVisible, setFollowersVisible] = useState(false);
    const [followingVisible, setFollowingVisible] = useState(false);
    const loggeduser = useAuthStore(s => s.user);
    const unblockUser = useAuthStore(s => s.unblockUser);

    const createConvMutation = useCreateConversation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    const { data: userDetails, isLoading: userLoading } = useQuery({
        queryKey: authKeys.userProfile(id),
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

    const handleUnblock = () => unblockUser(id);

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

            <div className={`w-full py-2 flex flex-col items-center`}>
                <div className={`w-full flex flex-col gap-4 bg-[var(--surface-1)]`} style={{ maxWidth: '400px' }}>
                    <div className="flex items-center justify-center text-center flex-col gap-1 w-full">
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
                                <span className="text-[10px] bg-[#808bf5]/10 text-[#808bf5] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border border-[#808bf5]/20">
                                    {userDetails.creatorTier} Elite
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
                                    className="w-full h-11 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-sm cursor-pointer hover:bg-red-500/20 transition"
                                >
                                    Re-enable Connection
                                </button>
                            )}

                            <button
                                onClick={handleShareProfile}
                                className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] font-semibold text-sm cursor-pointer hover:bg-[var(--surface-1)] transition"
                            >
                                🔗 Share Profile
                            </button>
                        </div>
                    )}

                    {!isBlockedByMe && (
                        <div className="grid grid-cols-4 gap-1.5  sm:gap-3 mt-2">
                            <div
                                className={`rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center transition-all ${isFollowing || loggeduser?._id === id ? 'cursor-pointer hover:bg-[var(--surface-1)] active:scale-95' : 'opacity-60 cursor-not-allowed'}`}
                                onClick={() => {
                                    if (isFollowing || loggeduser?._id === id) {
                                        setFollowersVisible(true);
                                    } else {
                                        toast.error('Follow this user to see their followers', { icon: '🔒' });
                                    }
                                }}
                            >
                                <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userDetails?.followers?.length || 0)}</h6>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-sub)] font-semibold text-center block">Followers</span>
                            </div>
                            <div
                                className={`rounded-xl bg-[var(--surface-2)] border border-[var(--border-color)] py-3 text-center transition-all ${isFollowing || loggeduser?._id === id ? 'cursor-pointer hover:bg-[var(--surface-1)] active:scale-95' : 'opacity-60 cursor-not-allowed'}`}
                                onClick={() => {
                                    if (isFollowing || loggeduser?._id === id) {
                                        setFollowingVisible(true);
                                    } else {
                                        toast.error('Follow this user to see who they follow', { icon: '🔒' });
                                    }
                                }}
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
                        <div className="flex flex-col gap-2">
                            <PostGrid userId={id} maxPosts={maxPosts} isCompactPreview={true} isBlur={isFollowing ? false : true} />
                            <button onClick={() => {
                                if (onClose) onClose();
                                if (id) navigate(`/profile/${id}`);
                            }} className="w-full h-9 text-sm font-semibold text-white bg-[#808bf5] hover:opacity-95 transition rounded-lg border-0 cursor-pointer">
                                View full profile
                            </button>
                        </div>
                    )}
                    <div>
                        {isBlockedByMe ? (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[var(--surface-2)] rounded-3xl border border-[var(--border-color)]">
                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-500/20">
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
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Dialog header={`Chat with ${userDetails.fullname}`} visible={chatVisible}
                style={{ width: '95vw', maxWidth: '500px', height: '90vh' }} position="center" onHide={() => setChatVisible(false)}>
                <ChatPanel participantId={id} />
            </Dialog>

            <Dialog
                header="Followers"
                visible={followersVisible}
                onHide={() => setFollowersVisible(false)}
                style={{ width: '95vw', maxWidth: '420px' }}
                className="rounded-3xl"
            >
                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {followersList.length === 0 ? (
                        <div className="text-center py-10 opacity-60">
                            <i className="pi pi-users text-4xl mb-3 block"></i>
                            <p className="m-0 text-sm">No followers yet</p>
                        </div>
                    ) : (
                        followersList.map(user => (
                            <div
                                key={user._id}
                                className="flex items-center gap-3 p-3 hover:bg-[var(--surface-2)] rounded-2xl cursor-pointer transition-colors group"
                                onClick={() => {
                                    setFollowersVisible(false);
                                    navigate(`/profile/${user._id}`);
                                }}
                            >
                                <img src={user.profile_picture || '/default-profile.png'} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-[var(--border-color)] group-hover:scale-105 transition-transform" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                        <p className="m-0 text-sm font-bold text-[var(--text-main)] truncate">{user.fullname}</p>
                                        {user.isVerified && <i className="pi pi-check-circle text-blue-500" style={{ fontSize: '12px' }}></i>}
                                    </div>
                                    <p className="m-0 text-[11px] text-[#808bf5] font-medium">@{user.username || 'user'}</p>
                                </div>
                                <i className="pi pi-chevron-right text-[10px] text-[var(--text-sub)] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </div>
                        ))
                    )}
                </div>
            </Dialog>

            <Dialog
                header="Following"
                visible={followingVisible}
                onHide={() => setFollowingVisible(false)}
                style={{ width: '95vw', maxWidth: '420px' }}
                className="rounded-3xl"
            >
                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {followingList.length === 0 ? (
                        <div className="text-center py-10 opacity-60">
                            <i className="pi pi-user-plus text-4xl mb-3 block"></i>
                            <p className="m-0 text-sm">Not following anyone yet</p>
                        </div>
                    ) : (
                        followingList.map(user => (
                            <div
                                key={user._id}
                                className="flex items-center gap-3 p-3 hover:bg-[var(--surface-2)] rounded-2xl cursor-pointer transition-colors group"
                                onClick={() => {
                                    setFollowingVisible(false);
                                    navigate(`/profile/${user._id}`);
                                }}
                            >
                                <img src={user.profile_picture || '/default-profile.png'} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-[var(--border-color)] group-hover:scale-105 transition-transform" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                        <p className="m-0 text-sm font-bold text-[var(--text-main)] truncate">{user.fullname}</p>
                                        {user.isVerified && <i className="pi pi-check-circle text-blue-500" style={{ fontSize: '12px' }}></i>}
                                    </div>
                                    <p className="m-0 text-[11px] text-[#808bf5] font-medium">@{user.username || 'user'}</p>
                                </div>
                                <i className="pi pi-chevron-right text-[10px] text-[var(--text-sub)] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </div>
                        ))
                    )}
                </div>
            </Dialog>
        </>
    );
};

export default UserProfile;