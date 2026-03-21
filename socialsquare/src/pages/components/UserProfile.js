import React, { useState, useEffect } from "react";
import { Image } from "primereact/image";
import { Dialog } from "primereact/dialog";
import useAuthStore from '../../store/zustand/useAuthStore';
import { useCreateConversation } from '../../hooks/queries/useConversationQueries';

import ChatPanel from './ChatPanel';

const BASE = process.env.REACT_APP_BACKEND_URL;

const PostGrid = ({ userId }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        fetch(`${BASE}/api/post/user/${userId}?limit=12`)
            .then(r => r.json())
            .then(data => { setPosts(data.posts || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userId]);

    if (loading) return (
        <div className="grid grid-cols-3 gap-1 mt-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-gray-100 rounded animate-pulse" style={{ aspectRatio: '1' }} />)}
        </div>
    );

    if (posts.length === 0) return <p className="text-center text-gray-400 text-sm py-6">No posts yet</p>;

    return (
        <div className="grid grid-cols-3 gap-1 mt-2">
            {posts.map(post => {
                const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                return (
                    <div key={post._id} className="relative rounded overflow-hidden bg-gray-100" style={{ aspectRatio: '1' }}>
                        {imgs[0]
                            ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-2 text-center">{post.caption?.slice(0, 30)}</div>
                        }
                        {imgs.length > 1 && (
                            <div className="absolute top-1 right-1 bg-black bg-opacity-50 rounded px-1">
                                <i className="pi pi-images text-white" style={{ fontSize: '10px' }}></i>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-2 py-1" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                            <span className="text-white text-xs">❤️ {post.likes?.length || 0}</span>
                            <span className="text-white text-xs">💬 {post.comments?.length || 0}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const UserProfile = ({ id }) => {
    const [userDetails, setUserDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');
    const [chatVisible, setChatVisible] = useState(false);

    const loggeduser = useAuthStore(s => s.user);
    const followUser = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const createConvMutation = useCreateConversation();
    const loadingState = {}; // follow/unfollow loading is handled by useAuthStore internally

    useEffect(() => {
        if (!id || !loggeduser?._id) return;
        setLoading(true);
        fetch(`${BASE}/api/auth/other-user/view`, {
            method: "GET", headers: { Authorization: `${id}` },
        })
            .then(r => r.json())
            .then(data => { setUserDetails(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id, loggeduser?._id]);

    const isFollowing = loggeduser?.following?.some(f => f?.toString() === id?.toString());

    const handleFollow = () => followUser(id);
    const handleUnfollow = () => unfollowUser(id);

    const handleMessage = () => {
        createConvMutation.mutate([
            { userId: loggeduser._id, fullname: loggeduser.fullname, profilePicture: loggeduser.profile_picture },
            { userId: id, fullname: userDetails.fullname, profilePicture: userDetails.profile_picture },
        ]);
        setChatVisible(true);
    };

    if (!id) return null;
    if (loading) return (
        <div className="flex flex-col items-center gap-3 p-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
    );
    if (!userDetails) return <p className="text-center text-gray-400 p-4">User not found</p>;

    const tabs = ['posts', 'followers', 'following'];

    return (
        <>
            <div>
                {/* Cover */}
                <div className="w-full overflow-hidden rounded-t-xl" style={{ height: '100px', background: 'linear-gradient(135deg, #808bf5, #ec4899)' }} />

                {/* Avatar */}
                <div className="flex flex-col items-center -mt-10 px-4">
                    <div className="border-4 border-white rounded-full overflow-hidden" style={{ width: 80, height: 80 }}>
                        <Image src={userDetails.profile_picture} zoomSrc={userDetails.profile_picture} alt="Profile"
                            width="80" height="80" preview imageStyle={{ objectFit: 'cover', width: 80, height: 80 }} />
                    </div>
                    <h3 className="m-0 mt-2 font-bold text-base pacifico-regular">{userDetails.fullname}</h3>
                    {userDetails.bio && <p className="text-xs text-gray-500 text-center mt-1 m-0">{userDetails.bio}</p>}
                </div>

                {/* Stats */}
                <div className="flex justify-around border-y py-3 mt-3 mx-4">
                    <div className="text-center">
                        <p className="m-0 font-bold text-sm">{userDetails.followers?.length || 0}</p>
                        <p className="m-0 text-xs text-gray-500">Followers</p>
                    </div>
                    <div className="text-center">
                        <p className="m-0 font-bold text-sm">{userDetails.following?.length || 0}</p>
                        <p className="m-0 text-xs text-gray-500">Following</p>
                    </div>
                </div>

                {/* Actions */}
                {loggeduser?._id !== id && (
                    <div className="flex gap-2 px-4 mt-3">
                        <button
                            onClick={isFollowing ? handleUnfollow : handleFollow}
                            disabled={loadingState.follow || loadingState.unfollow}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold border-0 cursor-pointer ${isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-[#808bf5] text-white'}`}
                        >
                            {loadingState.follow || loadingState.unfollow ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                        </button>
                        <button
                            onClick={handleMessage}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white cursor-pointer"
                        >
                            Message
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b mt-4 mx-4">
                    {tabs.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className="flex-1 py-2 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize"
                            style={{ borderBottom: activeTab === tab ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === tab ? '#808bf5' : '#6b7280' }}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="px-4 pb-4">
                    {activeTab === 'posts' && <PostGrid userId={id} />}
                    {activeTab === 'followers' && (
                        <div className="flex flex-col gap-2 mt-3">
                            {userDetails.followers?.length === 0
                                ? <p className="text-center text-gray-400 text-sm py-4">No followers yet</p>
                                : <p className="text-xs text-gray-400 text-center">{userDetails.followers?.length} followers</p>
                            }
                        </div>
                    )}
                    {activeTab === 'following' && (
                        <div className="flex flex-col gap-2 mt-3">
                            {userDetails.following?.length === 0
                                ? <p className="text-center text-gray-400 text-sm py-4">Not following anyone</p>
                                : <p className="text-xs text-gray-400 text-center">Following {userDetails.following?.length} people</p>
                            }
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Dialog */}
            <Dialog header={`Chat with ${userDetails.fullname}`} visible={chatVisible}
                style={{ width: '340px', height: '100vh' }} position="right" onHide={() => setChatVisible(false)}>
                <ChatPanel participantId={id} />
            </Dialog>
        </>
    );
};

export default UserProfile;