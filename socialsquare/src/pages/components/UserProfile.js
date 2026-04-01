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
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-gray-100 rounded-lg animate-pulse" style={{ aspectRatio: '1' }} />)}
        </div>
    );

    if (posts.length === 0) return <p className="text-center text-gray-400 text-sm py-6">No posts yet</p>;

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                {posts.map(post => {
                    const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                    return (
                        <div
                            key={post._id}
                            onClick={() => { setPostDetail(post); setPostDetailVisible(true); }}
                            className="relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition group"
                            style={{ aspectRatio: '1' }}
                        >
                            {imgs[0]
                                ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-2 text-center">{post.caption?.slice(0, 30)}</div>
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
            <div className="border shadow rounded-2xl bg-white border-gray-100 p-8 flex flex-col gap-6 items-center">
                <div className="w-24 h-24 rounded-full bg-gray-100 animate-pulse" />
                <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 w-28 bg-gray-50 rounded animate-pulse" />
                </div>
            </div>
        </div>
    );
    if (!userDetails) return <p className="text-center text-gray-400 p-4">User not found</p>;

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
                                className="profile-image-square overflow-hidden border-4 border-indigo-100"
                                style={{ '--size': '80px' }}
                                preview
                            />
                        </div>
                        <h3 className="m-0 text-lg sm:text-xl lg:text-2xl font-semibold">{userDetails?.fullname}</h3>
                        {userDetails?.username && (
                            <p className="m-0 text-sm font-medium text-indigo-600">@{userDetails.username}</p>
                        )}
                        {userDetails?.bio && (
                            <p className="text-sm text-gray-500 m-0 max-w-[260px] leading-6">{userDetails.bio}</p>
                        )}

                        {userDetails?.mutualCount > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex -space-x-2">
                                    {userDetails.mutualFollowers.map((m, idx) => (
                                        <img 
                                            key={m._id} 
                                            src={m.profile_picture} 
                                            alt={m.fullname} 
                                            className="w-6 h-6 rounded-full border-2 border-white object-cover"
                                            style={{ zIndex: 3 - idx }}
                                        />
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400 m-0">
                                    Followed by <strong>{userDetails.mutualFollowers[0]?.fullname}</strong> 
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
                                className={`h-10 sm:h-11 lg:h-12 rounded-xl border font-semibold text-sm cursor-pointer transition ${isFollowing ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : isRequested ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-default' : 'border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-95'}`}
                            >
                                {((followMutation.isPending && followMutation.variables?.targetUserId === id) || (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === id)) 
                                    ? '...' 
                                    : (isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow')}
                            </button>
                            <button
                                onClick={handleMessage}
                                className="h-10 sm:h-11 lg:h-12 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm cursor-pointer hover:bg-indigo-100 transition"
                            >
                                <i className="pi pi-send mr-2"></i>Message
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center">
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userDetails?.followers?.length || 0)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Followers</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center">
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userDetails?.following?.length || 0)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Following</span>
                        </div>
                    </div>

                    <div className="flex border-b border-gray-100">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2.5 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${activeTab === tab.key ? 'text-indigo-600' : 'text-gray-500'}`}
                                style={{ borderBottom: activeTab === tab.key ? '2px solid #808bf5' : '2px solid transparent' }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div>
                        {isPrivateAndNotFollowing ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                    <i className="pi pi-lock text-2xl text-gray-400"></i>
                                </div>
                                <h4 className="m-0 text-gray-800 font-bold mb-1">This Account is Private</h4>
                                <p className="m-0 text-sm text-gray-500">Follow this account to see their posts and stories.</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'posts' && <PostGrid userId={id} />}

                                {activeTab === 'followers' && (
                                    <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                                        {userDetails.followers?.length === 0 ? (
                                            <p className="text-center text-gray-400 text-sm py-4">No followers yet</p>
                                        ) : (
                                            followersList.map(user => (
                                                <div key={user._id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                                    <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="m-0 text-sm font-semibold text-gray-700 truncate">{user.fullname}</p>
                                                        {user.username && <p className="m-0 text-[11px] text-indigo-500">@{user.username}</p>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {activeTab === 'following' && (
                                    <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                                        {userDetails.following?.length === 0 ? (
                                            <p className="text-center text-gray-400 text-sm py-4">Not following anyone yet</p>
                                        ) : (
                                            followingList.map(user => (
                                                <div key={user._id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                                    <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="m-0 text-sm font-semibold text-gray-700 truncate">{user.fullname}</p>
                                                        {user.username && <p className="m-0 text-[11px] text-indigo-500">@{user.username}</p>}
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