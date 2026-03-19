import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import toast, { Toaster } from 'react-hot-toast';
import { resetState } from '../../store/slices/userSlice';
import { fetchUserPosts, fetchSavedPosts, resetUserPosts } from '../../store/slices/postsSlice';
import { socket } from '../../socket';
import EditProfile from './EditProfile';
import ActiveSessions from './ActiveSessions';
import FollowFollowingList from './FollowFollowingList';

const PostCard = ({ post }) => {
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    return (
        <div className="relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer" style={{ aspectRatio: '1' }}>
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
                <span className="text-white text-xs">❤️ {post.likes?.length || 0}</span>
                <span className="text-white text-xs">💬 {post.comments?.length || 0}</span>
            </div>
        </div>
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
    const { userPosts, savedPosts, savedPostIds, loading } = useSelector(state => state.posts);

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

    const tabPosts = activeTab === 'posts' ? userPosts : savedPosts;
    const isLoadingTab = activeTab === 'posts' ? loading.userPosts : loading.savedPosts;

    return (
        <>
            <div className="profile-container bg-white gap-1 pc-show">
                <div className="bordershadow p-3 rounded bg-white flex flex-col gap-1">

                    {/* Avatar + name */}
                    <div className="flex py-4 items-center justify-center text-center flex-col gap-1">
                        <div className="profile-pic-container">
                            <Image src={loggeduser?.profile_picture} zoomSrc={loggeduser?.profile_picture} alt="Profile" className="profile-pic rounded-full overflow-hidden" preview width="100" height="100" />
                        </div>
                        <h3 className="m-0 pacifico-regular">{loggeduser?.fullname}</h3>
                        {loggeduser?.bio && <p className="text-sm text-gray-500 m-0">{loggeduser.bio}</p>}
                    </div>

                    {/* Stats */}
                    <div className="flex justify-around border-t border-b py-3">
                        <div className="text-center cursor-pointer" onClick={() => setShowFollowersList(true)}>
                            <h6 className="m-0 font-bold">{loggeduser?.followers?.length || 0}</h6>
                            <span className="text-xs text-gray-500">Followers</span>
                        </div>
                        <div className="text-center">
                            <h6 className="m-0 font-bold">{userPosts.length}</h6>
                            <span className="text-xs text-gray-500">Posts</span>
                        </div>
                        <div className="text-center cursor-pointer" onClick={() => setShowFollowingList(true)}>
                            <h6 className="m-0 font-bold">{loggeduser?.following?.length || 0}</h6>
                            <span className="text-xs text-gray-500">Following</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-center gap-2 py-3 w-full">
                        <button className="btn bg-[#808bf5] border-0 rounded-xl text-white font-medium px-3 text-sm" onClick={() => setEditVisible(true)}>Edit Profile</button>
                        <button className="btn bg-[#808bf5] border-0 rounded-xl text-white font-medium px-3 text-sm" onClick={() => setActiveSessionsVisible(true)}>Sessions</button>
                        <button onClick={handleLogout} className="btn border border-gray-300 rounded-xl px-3">
                            <i className="pi pi-sign-out"></i>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b mb-2">
                        {['posts', 'saved'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${
                                    activeTab === tab
                                        ? 'text-indigo-500 border-b-2 border-indigo-500'
                                        : 'text-gray-500'
                                }`}
                                style={{ borderBottom: activeTab === tab ? '2px solid #808bf5' : '2px solid transparent' }}>
                                {tab === 'posts' ? `Posts (${userPosts.length})` : `Saved (${savedPosts.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Posts grid */}
                    <div className="grid grid-cols-3 gap-1">
                        {isLoadingTab ? (
                            [1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-gray-100 rounded-lg animate-pulse" style={{ aspectRatio: '1' }} />
                            ))
                        ) : tabPosts.length > 0 ? (
                            tabPosts.map(post => <PostCard key={post._id} post={post} />)
                        ) : (
                            <div className="col-span-3 text-center text-gray-400 text-sm py-6">
                                {activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}
                            </div>
                        )}
                    </div>
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