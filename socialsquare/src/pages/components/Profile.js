import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import toast, { Toaster } from 'react-hot-toast';
import { resetState } from '../../store/slices/userSlice';
import { fetchUserPosts, fetchSavedPosts, resetUserPosts } from '../../store/slices/postsSlice';
import { socket } from '../../socket';
import EditProfile from './EditProfile';
import ActiveSessions from '../ActiveSessions';
import FollowFollowingList from './FollowFollowingList';
import CollabManager from './CollabManager';

const PostCard = ({ post }) => {
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    return (
        <Link to={`/post/${post._id}`}>
            <div className="relative rounded-xl overflow-hidden bg-gray-100 cursor-pointer" style={{ aspectRatio: '1' }}>
                {images.length > 0 ? (
                    <img src={images[0]} alt="post" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs p-2 text-center">
                        {post.caption?.slice(0, 40)}
                    </div>
                )}
                {images.length > 1 && (
                    <div className="absolute top-1 right-1 bg-black bg-opacity-50 rounded px-1">
                        <i className="pi pi-images text-white" style={{ fontSize: '10px' }}></i>
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-2 py-1" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                    <span className="text-white text-[11px]">❤️ {post.likes?.length || 0}</span>
                    <span className="text-white text-[11px]">💬 {post.comments?.length || 0}</span>
                </div>
            </div>
        </Link>
    );
};

const Profile = () => {
    const [editVisible, setEditVisible] = useState(false);
    const [activeSessionsVisible, setActiveSessionsVisible] = useState(false);
    const [showFollowersList, setShowFollowersList] = useState(false);
    const [showFollowingList, setShowFollowingList] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { loggeduser, updateusersuccess, error: userError } = useSelector(state => state.users);
    const { userPosts, savedPosts, loading } = useSelector(state => state.posts);

    useEffect(() => {
        if (updateusersuccess) toast.success(updateusersuccess);
        if (userError?.updateuser) toast.error(userError.updateuser);
    }, [updateusersuccess, userError]);

    useEffect(() => {
        if (!loggeduser?._id) return;
        dispatch(resetUserPosts());
        dispatch(fetchUserPosts({ userId: loggeduser._id }));
        dispatch(fetchSavedPosts(loggeduser._id));
    }, [dispatch, loggeduser?._id]);

    const handleLogout = () => {
        confirmDialog({
            message: 'Are you sure you want to logout?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                localStorage.removeItem('socketId');
                localStorage.removeItem('token');
                sessionStorage.removeItem('hasReloaded');
                dispatch(resetState());
                toast.error('You have been logged out.');
                if (socket.connected) socket.emit('logoutUser', loggeduser?._id);
                setTimeout(() => navigate('/login'), 500);
            },
            reject: () => toast.error('Logout canceled.'),
        });
    };

    if (!loggeduser) return <div className="text-center p-4">Loading...</div>;

    // Only posts/saved use the grid — collabs has its own renderer
    const tabPosts = activeTab === 'posts' ? userPosts : savedPosts;
    const isLoadingTab = activeTab === 'posts' ? loading.userPosts : activeTab === 'saved' ? loading.savedPosts : false;

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    const TABS = [
        { key: 'posts',  label: `Posts (${userPosts.length})` },
        { key: 'saved',  label: `Saved (${savedPosts.length})` },
        { key: 'collabs', label: '🤝 Collabs' },
    ];

    return (
        <>
            <div className="profile-container pc-show">
                <div className="bordershadow rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-4">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="m-0 text-base font-semibold">My Profile</h2>
                        <button
                            onClick={() => setActiveSessionsVisible(true)}
                            className="border-0 bg-transparent cursor-pointer rounded-full p-2 text-gray-500 hover:bg-gray-100 transition"
                            title="Security settings"
                        >
                            <i className="pi pi-cog"></i>
                        </button>
                    </div>

                    {/* Avatar + identity */}
                    <div className="flex items-center justify-center text-center flex-col gap-1">
                        <div className="relative">
                            <Image
                                src={loggeduser?.profile_picture}
                                zoomSrc={loggeduser?.profile_picture}
                                alt="Profile"
                                className="rounded-full overflow-hidden border-4 border-indigo-100"
                                preview
                                width="100"
                                height="100"
                            />
                            <button
                                className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-0 cursor-pointer bg-[#4f46e5] text-white flex items-center justify-center"
                                onClick={() => setEditVisible(true)}
                                title="Edit profile"
                            >
                                <i className="pi pi-pencil text-[11px]"></i>
                            </button>
                        </div>
                        <h3 className="m-0 text-2xl font-semibold">{loggeduser?.fullname}</h3>
                        {loggeduser?.username && (
                            <p className="m-0 text-sm font-medium text-indigo-600">@{loggeduser.username}</p>
                        )}
                        {loggeduser?.bio && (
                            <p className="text-sm text-gray-500 m-0 max-w-[260px] leading-6">{loggeduser.bio}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            className="h-11 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm cursor-pointer hover:bg-indigo-100 transition"
                            onClick={() => setEditVisible(true)}
                        >
                            <i className="pi pi-user-edit mr-2"></i>Edit Profile
                        </button>
                        <button
                            onClick={handleLogout}
                            className="h-11 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm cursor-pointer hover:opacity-95 transition"
                        >
                            <i className="pi pi-sign-out mr-2"></i>Logout
                        </button>
                    </div>

                    {/* Stats tiles */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center cursor-pointer"
                            onClick={() => setShowFollowersList(true)}>
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(loggeduser?.followers?.length || 0)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Followers</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center cursor-pointer"
                            onClick={() => setShowFollowingList(true)}>
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(loggeduser?.following?.length || 0)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Following</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center">
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userPosts.length)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Posts</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2.5 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${
                                    activeTab === tab.key ? 'text-indigo-600' : 'text-gray-500'
                                }`}
                                style={{ borderBottom: activeTab === tab.key ? '2px solid #808bf5' : '2px solid transparent' }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {activeTab === 'collabs' ? (
                        // Collabs tab — full width, no grid
                        <CollabManager mode="all" />
                    ) : (
                        // Posts / Saved — 3-col grid
                        <div className="grid grid-cols-3 gap-2">
                            {isLoadingTab ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ aspectRatio: '1' }} />
                                ))
                            ) : tabPosts.length > 0 ? (
                                tabPosts.map(post => <PostCard key={post._id} post={post} />)
                            ) : (
                                <div className="col-span-3 text-center text-gray-400 text-sm py-6">
                                    {activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog />

            <Dialog header="Edit Profile" visible={editVisible} position="right" style={{ width: '340px', height: '100vh' }} onHide={() => setEditVisible(false)}>
                <EditProfile users={loggeduser} closeSidebar={() => setEditVisible(false)} />
            </Dialog>
            <Dialog header="Security & Sessions" visible={activeSessionsVisible} position="right" style={{ width: '340px', height: '100vh' }} onHide={() => setActiveSessionsVisible(false)}>
                <ActiveSessions />
            </Dialog>
            <Dialog header="Followers" visible={showFollowersList} style={{ width: '340px', height: '100vh' }} onHide={() => setShowFollowersList(false)}>
                <FollowFollowingList isfollowing={false} ids={loggeduser?.followers} />
            </Dialog>
            <Dialog header="Following" visible={showFollowingList} style={{ width: '340px', height: '100vh' }} onHide={() => setShowFollowingList(false)}>
                <FollowFollowingList isfollowing={true} ids={loggeduser?.following} />
            </Dialog>
            <Toaster />
        </>
    );
};

export default Profile;