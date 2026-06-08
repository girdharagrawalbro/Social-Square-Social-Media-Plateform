import React, { useMemo, useState } from 'react';
import useAuthStore from '../store/zustand/useAuthStore';
import { useNotifications } from '../hooks/useNotifications';
import { useCollabInvites, useAcceptFollowRequest, useDeclineFollowRequest } from '../hooks/queries/useAuthQueries';
import usePostStore from '../store/zustand/usePostStore';
import { useNavigate } from 'react-router-dom';
import CollabManager from './components/CollabManager';

const NotificationsPage = () => {
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'requests' | 'collabs'
    const { data: notifications = [], markRead, loadMore, hasMore, isLoading, updateNotification } = useNotifications(user?._id);
    const { data: collabInvites = [] } = useCollabInvites(user?._id);

    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    const acceptMutation = useAcceptFollowRequest();
    const declineMutation = useDeclineFollowRequest();

    // ✅ Auto-mark all as read when opening page
    //   useEffect(() => {
    //     const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
    //     if (unreadIds.length > 0) {
    //         markRead.mutate(unreadIds);
    //     }
    // }, [notifications, markRead]);

    const handleMarkRead = (id) => markRead.mutate([id]);

    const handleAccept = async (e, requesterId, notificationId) => {
        e.stopPropagation();
        try {
            await acceptMutation.mutateAsync({ requesterId });
            updateNotification(notificationId, { status: 'accepted', read: true });
        } catch { }
    };

    const handleDecline = async (e, requesterId, notificationId) => {
        e.stopPropagation();
        try {
            await declineMutation.mutateAsync({ requesterId });
            updateNotification(notificationId, { status: 'rejected', read: true });
        } catch { }
    };

    const getNotificationText = (n) => {
        if (n.type === 'new_post') return 'created a new post.';
        if (n.type === 'message') return `sent you a message: "${n.message?.content || ''}"`;
        if (n.type === 'like') return n.url?.includes('stories') ? 'liked your story.' : 'liked your post.';
        if (n.type === 'comment') return 'commented on your post.';
        if (n.type === 'follow') return 'started following you.';
        if (n.type === 'follow_request') return 'sent you a follow request.';
        if (n.type === 'system') return n.message?.content || 'Security alert.';
        if (n.type === 'announcement') return n.message?.content || 'New announcement.';
        return 'sent a notification.';
    };

    const formatTime = (dateString) => {
        const diff = Date.now() - new Date(dateString);
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d`;
        return `${Math.floor(days / 7)}w`;
    };

    // Group Notifications
    const groupedNotifications = useMemo(() => {
        const groups = {
            'Today': [],
            'This Week': [],
            'Earlier': []
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = new Date(startOfToday - 6 * 24 * 60 * 60 * 1000).getTime();

        notifications.forEach(n => {
            const time = new Date(n.createdAt).getTime();
            if (time >= startOfToday) {
                groups['Today'].push(n);
            } else if (time >= startOfWeek) {
                groups['This Week'].push(n);
            } else {
                groups['Earlier'].push(n);
            }
        });

        // Filter out empty groups
        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [notifications]);

    // Follow Requests Filter
    const followRequests = useMemo(() => {
        return notifications.filter(n => n.type === 'follow_request');
    }, [notifications]);

    return (
        <div className="flex justify-center min-h-[calc(100vh-64px)] bg-[var(--app-bg)] w-full">
            <div className="w-full max-w-2xl bg-[var(--surface-1)] ">
                <div className="sticky top-0 z-20 bg-[var(--surface-1)]/90 backdrop-blur-md border-b border-[var(--border-color)]">
                    <div className="px-3 pt-3 pb-2">
                        <h2 className="text-xl font-bold m-0 text-[var(--text-main)]">Notifications</h2>
                    </div>
                    {/* Tabs */}
                    <div className="flex w-full px-2">
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'notifications' ? 'border-[#808bf5] text-[#808bf5]' : 'border-transparent text-[var(--text-sub)]'}`}
                        >
                            <i className="pi pi-bell mr-2"></i>
                            Activity
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors relative ${activeTab === 'requests' ? 'border-[#808bf5] text-[#808bf5]' : 'border-transparent text-[var(--text-sub)]'}`}
                        >
                            <i className="pi pi-user-plus mr-2"></i>
                            Requests
                            {followRequests.filter(r => !r.read).length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] inline-block text-center font-black">
                                    {followRequests.filter(r => !r.read).length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('collabs')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors relative ${activeTab === 'collabs' ? 'border-[#808bf5] text-[#808bf5]' : 'border-transparent text-[var(--text-sub)]'}`}
                        >
                            <i className="pi pi-users mr-2"></i>
                            Collabs
                            {collabInvites.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] inline-block text-center font-black">
                                    {collabInvites.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {activeTab === 'notifications' ? (
                    <>
                        {isLoading && notifications.length === 0 ? (
                            <div className="flex flex-col gap-4 p-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex gap-3 animate-pulse">
                                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full" />
                                        <div className="flex-1 flex flex-col gap-2 py-1">
                                            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                                            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-[var(--text-sub)] animate-fade-in">
                                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-6 shadow-lg border border-indigo-500/10 rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <i className="pi pi-bell text-5xl text-[#808bf5] animate-swing"></i>
                                </div>
                                <h3 className="text-2xl font-black text-[var(--text-main)] mb-2 font-outfit">All Quiet for Now</h3>
                                <p className="text-center max-w-sm leading-relaxed text-sm">When someone likes, comments, or interacts with your posts, you'll see a record of it here.</p>
                            </div>
                        ) : (
                            <div className="pb-20">
                                {/* Collab Invites Section (if any) */}
                                {collabInvites.length > 0 && (
                                    <div className="px-4 py-4 border-b border-[var(--border-color)] bg-[var(--surface-2)] mx-4 my-3 rounded-2xl">
                                        <h3 className="text-[10px] font-black text-[var(--text-sub)] mb-2 uppercase tracking-widest">Collab Requests</h3>
                                        <button
                                            onClick={() => setActiveTab('collabs')}
                                            className="w-full text-left bg-transparent border-0 cursor-pointer flex items-center justify-between text-[#808bf5] font-bold"
                                        >
                                            <span className="text-sm">You have {collabInvites.length} pending collab request{collabInvites.length > 1 ? 's' : ''}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-[#808bf5] text-white px-2 py-1 rounded-full">VIEW ALL</span>
                                                <i className="pi pi-chevron-right text-xs"></i>
                                            </div>
                                        </button>
                                    </div>
                                )}

                                {/* Render Grouped Notifications */}
                                {groupedNotifications.map(([groupName, items]) => (
                                    <div key={groupName}>
                                        <div className="px-4 pt-4 pb-2">
                                            <h3 className="text-[13px] font-black text-[var(--text-sub)] uppercase tracking-wider m-0">{groupName}</h3>
                                        </div>
                                        <div>
                                            {items.map(n => (
                                                <div
                                                    key={n._id}
                                                    onClick={() => {
                                                        handleMarkRead(n._id);
                                                        if (n.type === 'message' && n.sender) {
                                                            const targetId = n.sender.id || n.sender._id;
                                                            if (targetId) navigate(`/conversation/${targetId}`);
                                                        } else if (n.type === 'like' && n.story) {
                                                            setStoryDetailUserId(n.sender.id || n.sender._id);
                                                        } else if (n.post) {
                                                            setPostDetailId(n.post);
                                                        } else if (n.type === 'follow') {
                                                            const id = n.sender.id || n.sender._id;
                                                            if (id) navigate(`/profile/${id}`);
                                                        } else if (n.type === 'collab_invite') {
                                                            setActiveTab('collabs');
                                                        }
                                                    }}
                                                    className={`flex items-start gap-4 px-3 py-3 cursor-pointer transition-all duration-300 relative hover:bg-[var(--surface-2)]/60 ${!n.read
                                                        ? 'bg-gray-100 hover:bg-gray-200/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60 '
                                                        : ''
                                                        }`}
                                                >
                                                    <div className="relative shrink-0 select-none">
                                                        <img
                                                            src={n.type === 'system' ? 'https://img.icons8.com/fluency/96/shield.png' : n.type === 'announcement' ? 'https://img.icons8.com/fluency/96/megaphone.png' : (n.sender?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg')}
                                                            alt=""
                                                            className="w-12 h-12 rounded-full object-cover border border-[var(--border-color)] shadow-sm hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => { e.target.src = 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'; }}
                                                        />
                                                         {/* Type Badge Overlay */}
                                                        {n.type !== 'system' && n.type !== 'announcement' && (
                                                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white border-2 border-[var(--surface-1)] shadow-md ${n.type === 'like' ? 'bg-gradient-to-tr from-rose-500 to-pink-400' :
                                                                n.type === 'comment' ? 'bg-gradient-to-tr from-purple-600 to-indigo-400' :
                                                                    n.type === 'follow' || n.type === 'follow_request' ? 'bg-gradient-to-tr from-blue-500 to-cyan-400' :
                                                                        n.type === 'message' ? 'bg-gradient-to-tr from-green-500 to-emerald-400' :
                                                                            'bg-gray-500'
                                                                }`}>
                                                                <i className={`pi text-[9px] ${n.type === 'like' ? 'pi-heart-fill' :
                                                                    n.type === 'comment' ? 'pi-comment' :
                                                                        n.type === 'follow' || n.type === 'follow_request' ? 'pi-user-plus' :
                                                                            n.type === 'message' ? 'pi-envelope' :
                                                                                'pi-info-circle'
                                                                    }`}></i>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <p className="m-0 text-[14px] text-[var(--text-main)] leading-tight">
                                                            <span className="font-bold cursor-pointer hover:underline" onClick={(e) => {
                                                                e.stopPropagation();
                                                                const id = n.sender?.id || n.sender?._id;
                                                                if (id && n.type !== 'system' && n.type !== 'announcement') navigate(`/profile/${id}`);
                                                            }}>
                                                                {n.type === 'system' ? 'Security Alert' : n.type === 'announcement' ? 'System Announcement' : (n.sender?.username || n.sender?.fullname || 'User')}
                                                            </span>{' '} <br />
                                                            <span className="text-[var(--text-main)] opacity-90 text-[11px]">{getNotificationText(n)}</span>{' '}<br />
                                                            <span className="text-[var(--text-sub)] text-[11px] font-medium mt-1 block italic">{formatTime(n.createdAt)}</span>
                                                        </p>

                                                        {n.type === 'follow_request' && (
                                                            <div className="flex gap-2 mt-3">
                                                                {n.status === 'accepted' ? (
                                                                    <span className="text-[#808bf5] text-sm font-bold bg-[#808bf5]/10 px-4 py-1.5 rounded-xl">Accepted</span>
                                                                ) : n.status === 'rejected' ? (
                                                                    <span className="text-red-500 text-sm font-bold bg-red-500/10 px-4 py-1.5 rounded-xl">Rejected</span>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => handleAccept(e, n.sender.id || n.sender._id, n._id)}
                                                                            disabled={acceptMutation.isPending}
                                                                            className="bg-[#808bf5] text-white border-0 rounded-xl px-4 py-1.5 text-[13px] font-bold cursor-pointer hover:bg-[#6366f1] transition-all transform active:scale-95"
                                                                        >
                                                                            {acceptMutation.isPending && acceptMutation.variables?.requesterId === (n.sender.id || n.sender._id) ? '...' : 'Confirm'}
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleDecline(e, n.sender.id || n.sender._id, n._id)}
                                                                            disabled={declineMutation.isPending}
                                                                            className="bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl px-4 py-1.5 text-[13px] font-bold cursor-pointer hover:bg-[var(--surface-3)] transition-all transform active:scale-95"
                                                                        >
                                                                            {declineMutation.isPending && declineMutation.variables?.requesterId === (n.sender.id || n.sender._id) ? '...' : 'Delete'}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Trailing item */}
                                                    <div className="flex items-center justify-center pt-1 shrink-0">
                                                        {n.thumbnail ? (
                                                            <img
                                                                src={n.thumbnail}
                                                                alt=""
                                                                className="w-11 h-11 rounded-xl object-cover border border-[var(--border-color)] shadow-sm"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : !n.read && n.type !== 'follow_request' ? (
                                                            ""
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hasMore && (
                            <div className="p-8 text-center">
                                <button
                                    onClick={() => loadMore()}
                                    disabled={isLoading}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] px-6 py-2 rounded-full text-[#808bf5] text-sm font-bold cursor-pointer hover:bg-[var(--surface-3)] transition-all"
                                >
                                    {isLoading ? 'Loading...' : 'Load more activity'}
                                </button>
                            </div>
                        )}
                    </>
                ) : activeTab === 'requests' ? (
                    <div className="pb-20">
                        {followRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-[var(--text-sub)] animate-fade-in">
                                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mb-6 shadow-lg border border-blue-500/10 rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <i className="pi pi-user-plus text-5xl text-[#808bf5] animate-swing"></i>
                                </div>
                                <h3 className="text-2xl font-black text-[var(--text-main)] mb-2 font-outfit">No Follow Requests</h3>
                                <p className="text-center max-w-sm leading-relaxed text-sm">When users request to follow your private account, they'll show up here.</p>
                            </div>
                        ) : (
                            <div>
                                {followRequests.map(n => (
                                    <div
                                        key={n._id}
                                        className="flex items-center gap-4 p-3 border-b border-gray-100 hover:bg-[var(--surface-2)]/60 transition-colors"
                                    >
                                        <div className="relative shrink-0 select-none">
                                            <img
                                                src={n.type === 'system' ? 'https://img.icons8.com/fluency/96/shield.png' : n.type === 'announcement' ? 'https://img.icons8.com/fluency/96/megaphone.png' : (n.sender?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg')}
                                                alt=""
                                                className="w-12 h-12 rounded-full object-cover border border-[var(--border-color)] shadow-sm hover:scale-105 transition-transform duration-300"
                                                onClick={() => {
                                                    const id = n.sender?.id || n.sender?._id;
                                                    if (id && n.type !== 'system' && n.type !== 'announcement') navigate(`/profile/${id}`);
                                                }}
                                            />
                                            {/* Follow type badge overlay */}
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white border-2 border-[var(--surface-1)] shadow-md bg-gradient-to-tr from-blue-500 to-cyan-400">
                                                <i className="pi pi-user-plus text-[9px]"></i>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="m-0 text-[14px] font-bold text-[var(--text-main)]" onClick={() => {
                                                const id = n.sender?.id || n.sender?._id;
                                                if (id && n.type !== 'system' && n.type !== 'announcement') navigate(`/profile/${id}`);
                                            }}>
                                                {n.type === 'system' ? 'Security Alert' : n.type === 'announcement' ? 'System Announcement' : (n.sender?.username || n.sender?.fullname || 'User')}
                                            </p>
                                            <p className="m-0 text-[12px] text-[var(--text-sub)]">{getNotificationText(n)}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {n.status === 'accepted' ? (
                                                <span className="text-[#808bf5] text-xs font-bold bg-[#808bf5]/10 px-4 py-1.5 rounded-lg">Accepted</span>
                                            ) : n.status === 'rejected' ? (
                                                <span className="text-red-500 text-xs font-bold bg-red-500/10 px-4 py-1.5 rounded-lg">Rejected</span>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={(e) => handleAccept(e, n.sender.id || n.sender._id, n._id)}
                                                        className="bg-[#808bf5] text-white border-0 rounded-lg px-4 py-1.5 text-[12px] font-bold cursor-pointer hover:bg-[#6366f1] transition-all"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDecline(e, n.sender.id || n.sender._id, n._id)}
                                                        className="bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg px-4 py-1.5 text-[12px] font-bold cursor-pointer hover:bg-[var(--surface-3)] transition-all"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 pb-20">
                        <CollabManager mode="invites" />
                    </div>
                )}
            </div>
            <style>{`
                @keyframes swing {
                    0%, 100% { transform: rotate(3deg); }
                    50%      { transform: rotate(-3deg); }
                }
                .animate-swing {
                    animation: swing 2.5s ease-in-out infinite;
                    transform-origin: 50% 10%;
                }
            `}</style>
        </div>
    );
};

export default NotificationsPage;
