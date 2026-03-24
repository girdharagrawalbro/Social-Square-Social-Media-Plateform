import React, { useState, useEffect } from "react";
import { Image } from "primereact/image";
import { Dialog } from "primereact/dialog";
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useCreateConversation } from '../../hooks/queries/useConversationQueries';
import ChatPanel from './ChatPanel';
import PostDetail from './PostDetail';
import toast from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const PostGrid = ({ userId }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [postDetail, setPostDetail] = useState(null);

    useEffect(() => {
        if (!userId) return;
        fetch(`${BASE}/api/post/user/${userId}?limit=12`)
            .then(r => r.json())
            .then(data => { setPosts(data.posts || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userId]);

    if (loading) return (
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

            <Dialog visible={postDetailVisible} style={{ width: '95vw', maxWidth: '1000px', height: '80vh' }} onHide={() => setPostDetailVisible(false)} modal header="Post Detail" className="p-0">
                <PostDetail post={postDetail} onHide={() => setPostDetailVisible(false)} />
            </Dialog>
        </>
    );
};

const UserProfile = ({ id }) => {
    const [userDetails, setUserDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');
    const [chatVisible, setChatVisible] = useState(false);
    const [followersList, setFollowersList] = useState([]);
    const [followingList, setFollowingList] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    const loggeduser = useAuthStore(s => s.user);
    const followUser = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const createConvMutation = useCreateConversation();

    useEffect(() => {
        if (!id || !loggeduser?._id) return;
        setLoading(true);
        api.get(`/api/auth/other-user/view/${id}`)
            .then(r => r.data)
            .then(data => { setUserDetails(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id, loggeduser?._id]);

    useEffect(() => {
        if (!userDetails || !id) return;
        
        if (activeTab === 'followers' && userDetails.followers?.length > 0) {
            setListLoading(true);
            fetch(`${BASE}/api/auth/users/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: userDetails.followers })
            })
                .then(r => r.json())
                .then(data => { setFollowersList(data.users || []); setListLoading(false); })
                .catch(() => setListLoading(false));
        }
        
        if (activeTab === 'following' && userDetails.following?.length > 0) {
            setListLoading(true);
            fetch(`${BASE}/api/auth/users/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: userDetails.following })
            })
                .then(r => r.json())
                .then(data => { setFollowingList(data.users || []); setListLoading(false); })
                .catch(() => setListLoading(false));
        }
    }, [activeTab, userDetails, id]);

    const isFollowing = loggeduser?.following?.some(f => f?.toString() === id?.toString());

    const handleFollow = () => followUser(id);
    const handleUnfollow = () => unfollowUser(id);

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
    if (loading) return (
        <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl">
            <div className="border shadow rounded-2xl bg-white border-gray-100 p-3 sm:p-4 lg:p-5 xl:p-6 flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
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
                <div className="border-gray-100 flex flex-col gap-4">

                    {/* Avatar + Identity */}
                    <div className="flex items-center justify-center text-center flex-col gap-1">
                        <div className="relative">
                            <Image
                                src={userDetails?.profile_picture}
                                zoomSrc={userDetails?.profile_picture}
                                alt="Profile"
                                className="rounded-full overflow-hidden border-4 border-indigo-100"
                                preview
                                width="80"
                                height="80"
                            />
                        </div>
                        <h3 className="m-0 text-lg sm:text-xl lg:text-2xl font-semibold">{userDetails?.fullname}</h3>
                        {userDetails?.bio && (
                            <p className="text-sm text-gray-500 m-0 max-w-[260px] leading-6">{userDetails.bio}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    {loggeduser?._id !== id && (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={isFollowing ? handleUnfollow : handleFollow}
                                className={`h-10 sm:h-11 lg:h-12 rounded-xl border font-semibold text-sm cursor-pointer transition ${isFollowing ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-95'}`}
                            >
                                {isFollowing ? 'Following' : 'Follow'}
                            </button>
                            <button
                                onClick={handleMessage}
                                className="h-10 sm:h-11 lg:h-12 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm cursor-pointer hover:bg-indigo-100 transition"
                            >
                                <i className="pi pi-send mr-2"></i>Message
                            </button>
                        </div>
                    )}

                    {/* Stats tiles */}
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

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2.5 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${activeTab === tab.key ? 'text-indigo-600' : 'text-gray-500'
                                    }`}
                                style={{ borderBottom: activeTab === tab.key ? '2px solid #808bf5' : '2px solid transparent' }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div>
                        {activeTab === 'posts' && <PostGrid userId={id} />}

                        {activeTab === 'followers' && (
                            <div className="flex flex-col gap-3 mt-3">
                                {listLoading ? (
                                    <p className="text-center text-gray-400 text-sm py-4">Loading followers...</p>
                                ) : userDetails.followers?.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-4">No followers yet</p>
                                ) : (
                                    followersList.map(user => (
                                        <div key={user._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                            <p className="m-0 text-sm font-semibold text-gray-700">{user.fullname}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'following' && (
                            <div className="flex flex-col gap-3 mt-3">
                                {listLoading ? (
                                    <p className="text-center text-gray-400 text-sm py-4">Loading following...</p>
                                ) : userDetails.following?.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-4">Not following anyone yet</p>
                                ) : (
                                    followingList.map(user => (
                                        <div key={user._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                            <p className="m-0 text-sm font-semibold text-gray-700">{user.fullname}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Dialog */}
            <Dialog header={`Chat with ${userDetails.fullname}`} visible={chatVisible}
             style={{ width: '95vw', maxWidth: '500px', height: '90vh' }}  position="center" onHide={() => setChatVisible(false)}>
                <ChatPanel participantId={id} />
            </Dialog>
        </>
    );
};

export default UserProfile;