import { useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useUserPosts, useSavedPosts } from '../../hooks/queries/usePostQueries';
import { useNavigate } from 'react-router-dom';
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




const Profile = () => {
    const [editVisible, setEditVisible] = useState(false);
    const [activeSessionsVisible, setActiveSessionsVisible] = useState(false);
    const [showFollowersList, setShowFollowersList] = useState(false);
    const [showFollowingList, setShowFollowingList] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [postDetail, setPostDetail] = useState(null);
    const loggeduser = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);
    const { data: userPosts = [], isLoading: loadingUserPosts } = useUserPosts(loggeduser?._id);
    const { data: savedPostsData = [] } = useSavedPosts(loggeduser?._id);
    const userPostsList = userPosts?.pages?.flatMap(p => p.posts) || [];
    const savedPosts = savedPostsData || [];
    // const loading = { userPosts: loadingUserPosts, savedPosts: false };



    const handleLogout = () => {
        confirmDialog({
            message: 'Are you sure you want to logout?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                sessionStorage.removeItem('hasReloaded');
                logout();
                toast.error('You have been logged out.');
                if (socket.connected) socket.emit('logoutUser', loggeduser?._id);
                window.location.href = '/login';
            },
            reject: () => toast.error('Logout canceled.'),
        });
    };

    if (!loggeduser) return <div className="text-center p-4">Loading...</div>;

    // Only posts/saved use the grid — collabs has its own renderer
    const tabPosts = activeTab === 'posts' ? userPostsList : savedPosts;
    const isLoadingTab = activeTab === 'posts' ? loadingUserPosts : false;

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    const TABS = [
        { key: 'posts', label: `Posts (${userPostsList.length})` },
        { key: 'saved', label: `Saved (${savedPosts.length})` },
        { key: 'collabs', label: '🤝 Collabs' },
    ];

    return (
        <>
            <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl">
                <div className="bordershadow rounded-2xl bg-white border border-gray-100 
p-3 sm:p-4 lg:p-5 xl:p-6 flex flex-col gap-4">

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
                                width="80"
                                height="80"
                            />
                            <button
                                className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-0 cursor-pointer bg-[#4f46e5] text-white flex items-center justify-center"
                                onClick={() => setEditVisible(true)}
                                title="Edit profile"
                            >
                                <i className="pi pi-pencil text-[11px]"></i>
                            </button>
                        </div>
                        <h3 className="m-0 text-lg sm:text-xl lg:text-2xl font-semibold">{loggeduser?.fullname}</h3>
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

                    {/* Stats tiles */}
                    <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3">
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
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userPostsList.length)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Posts</span>
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
                    {activeTab === 'collabs' ? (
                        // Collabs tab — full width, no grid
                        <CollabManager mode="all" />
                    ) : (
                        // Posts / Saved — 3-col grid   
                       <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                            {isLoadingTab ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ aspectRatio: '1' }} />
                                ))
                            ) : tabPosts.length > 0 ? (
                                tabPosts.map(post => <PostCard key={post._id} post={post} onClick={(post) => { setPostDetail(post); setPostDetailVisible(true); }} />)
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
            <Dialog header="Post Detail" visible={postDetailVisible} style={{ width: '95vw', maxWidth: '1000px', height: '80vh' }} onHide={() => setPostDetailVisible(false)} modal className="p-0">
                <PostDetail post={postDetail} onHide={() => setPostDetailVisible(false)} />
            </Dialog>

            <Toaster />
        </>
    );
};

export default Profile;