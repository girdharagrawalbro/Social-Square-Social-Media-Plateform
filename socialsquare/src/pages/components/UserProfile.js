import React, { useState, lazy, Suspense } from "react";
import { Image } from "primereact/image";
import { Dialog } from "primereact/dialog";
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useCreateConversation } from '../../hooks/queries/useConversationQueries';
import { useUserDetails, useFollowUser, useUnfollowUser } from '../../hooks/queries/useAuthQueries';
import { useUserPosts } from '../../hooks/queries/usePostQueries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChatPanel from './ChatPanel';
import toast from 'react-hot-toast';

const PostDetail = lazy(() => import('./PostDetail'));


const PostGrid = ({ userId }) => {
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [postDetail, setPostDetail] = useState(null);

    const {
        data,
        isLoading
    } = useUserPosts(userId);

    const posts = data?.pages.flatMap(page => page.posts) || [];

    if (isLoading && posts.length === 0) return (
        <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-[var(--surface-2)] rounded-lg animate-pulse" style={{ aspectRatio: '1' }} />)}
        </div>
    );

    if (posts.length === 0) return <p className="text-center text-[var(--text-sub)] text-sm py-6">No posts yet</p>;

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                {posts.map(post => {
                    const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                    return (
                        <div
                            key={post._id}
                            onClick={() => { setPostDetail(post); setPostDetailVisible(true); }}
                            className="relative rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer hover:opacity-90 transition group"
                            style={{ aspectRatio: '1' }}
                        >
                            {imgs[0]
                                ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-sub)] p-2 text-center">{post.caption?.slice(0, 30)}</div>
                            }
                            {imgs.length > 1 && (
                                <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-1">
                                    <i className="pi pi-images text-white" style={{ fontSize: '12px' }}></i>
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 flex gap-3 px-2 py-2 opacity-0 group-hover:opacity-100 transition" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                                <span className="text-white text-xs font-semibold">❤️ {post.likes?.length || 0}</span>
                                <span className="text-white text-xs font-semibold">💬 {post.comments?.length || 0}</span>
                            </div>
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
    const createConvMutation = useCreateConversation();
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

    const isFollowing = loggeduser?.following?.some(f => f?.toString() === id?.toString());
    const isRequested = userDetails?.followRequests?.some(r => r?.toString() === loggeduser?._id?.toString());
    const isPrivateAndNotFollowing = userDetails?.isPrivate && !isFollowing && loggeduser?._id !== id;

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

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    if (!id) return null;
    if (userLoading) return (
        <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl p-4">
            <div className="border shadow rounded-2xl bg-[var(--surface-1)] border-[var(--border-color)] p-8 flex flex-col gap-6 items-center">
                <div className="w-24 h-24 rounded-full bg-[var(--surface-2)] animate-pulse" />
                <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-40 bg-[var(--surface-2)] rounded animate-pulse" />
                    <div className="h-4 w-28 bg-[var(--surface-2)] rounded animate-pulse" />
                </div>
            </div>
        </div>
    );
    if (!userDetails) return <p className="text-center text-[var(--text-sub)] p-4">User not found</p>;

    const TABS = [
        { key: 'posts', label: `Posts` },
        { key: 'followers', label: `Followers` },
        { key: 'following', label: `Following` },
    ];

    return (
        <>
            <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl">
                <div className="flex flex-col gap-4">
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
                        <h3 className="m-0 text-lg sm:text-xl lg:text-2xl font-semibold text-[var(--text-main)]">{userDetails?.fullname}</h3>
                        {userDetails?.username && (
                            <p className="m-0 text-sm font-medium text-[#808bf5]">@{userDetails.username}</p>
                        )}
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
                    )}

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

                    <div>
                        {isPrivateAndNotFollowing ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[var(--surface-2)] rounded-2xl border border-dashed border-[var(--border-color)]">
                                <div className="w-16 h-16 bg-[var(--surface-1)] rounded-full flex items-center justify-center shadow-sm mb-4">
                                    <i className="pi pi-lock text-2xl text-[var(--text-sub)]"></i>
                                </div>
                                <h4 className="m-0 text-[var(--text-main)] font-bold mb-1">This Account is Private</h4>
                                <p className="m-0 text-sm text-[var(--text-sub)]">Follow this account to see their posts and stories.</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'posts' && <PostGrid userId={id} />}

                                {activeTab === 'followers' && (
                                    <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                                        {userDetails.followers?.length === 0 ? (
                                            <p className="text-center text-[var(--text-sub)] text-sm py-4">No followers yet</p>
                                        ) : (
                                            followersList.map(user => (
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
                                )}

                                {activeTab === 'following' && (
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
                                )}
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