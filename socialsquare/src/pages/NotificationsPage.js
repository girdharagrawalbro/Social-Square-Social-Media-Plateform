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
    const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'collabs'
    const { data: notifications = [], markRead, loadMore, hasMore, isLoading } = useNotifications(user?._id);
    const { data: collabInvites = [] } = useCollabInvites(user?._id);

    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    const acceptMutation = useAcceptFollowRequest();
    const declineMutation = useDeclineFollowRequest();

    // ✅ Auto-mark all as read when opening page
    React.useEffect(() => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
        if (unreadIds.length > 0) {
            markRead.mutate(unreadIds);
        }
    }, [notifications.length, markRead]);

    const handleMarkRead = (id) => markRead.mutate([id]);

    const handleAccept = async (e, requesterId, notificationId) => {
        e.stopPropagation();
        try {
            await acceptMutation.mutateAsync({ requesterId });
            handleMarkRead(notificationId);
        } catch { }
    };

    const handleDecline = async (e, requesterId, notificationId) => {
        e.stopPropagation();
        try {
            await declineMutation.mutateAsync({ requesterId });
            handleMarkRead(notificationId);
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

    return (
        <div className="flex justify-center min-h-[calc(100vh-64px)] bg-[var(--app-bg)] w-full">
            <div className="w-full max-w-2xl bg-[var(--surface-1)] border-x border-[var(--border-color)]">
                <div className="sticky top-0 z-20 bg-[var(--surface-1)]/90 backdrop-blur-md border-b border-[var(--border-color)]">
                    <div className="p-4">
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
                            <div className="flex flex-col items-center justify-center p-12 text-[var(--text-sub)]">
                                <div className="w-24 h-24 rounded-full border-2 border-[var(--border-color)] flex items-center justify-center mb-4">
                                    <i className="pi pi-bell text-4xl"></i>
                                </div>
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Activity On Your Posts</h3>
                                <p className="text-center">When someone likes or comments on one of your posts, you'll see it here.</p>
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
                                                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${!n.read ? 'bg-[#808bf5]/5' : 'hover:bg-[var(--surface-2)]'}`}
                                                >
                                                    <img
                                                        src={n.sender?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`}
                                                        alt=""
                                                        className="w-11 h-11 rounded-full object-cover border border-[var(--border-color)] shadow-sm"
                                                        onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`; }}
                                                    />

                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <p className="m-0 text-[14px] text-[var(--text-main)] leading-tight">
                                                            <span className="font-bold cursor-pointer hover:underline" onClick={(e) => {
                                                                e.stopPropagation();
                                                                const id = n.sender.id || n.sender._id;
                                                                if (id) navigate(`/profile/${id}`);
                                                            }}>
                                                                {n.sender?.username || n.sender?.fullname || 'User'}
                                                            </span>{' '}
                                                            <span className="text-[var(--text-main)] opacity-90">{getNotificationText(n)}</span>{' '}<br />
                                                            <span className="text-[var(--text-sub)] text-[11px] font-medium mt-1 block italic">{formatTime(n.createdAt)}</span>
                                                        </p>

                                                        {n.type === 'follow_request' && !n.read && (
                                                            <div className="flex gap-2 mt-3">
                                                                <button
                                                                    onClick={(e) => handleAccept(e, n.sender.id || n.sender._id, n._id)}
                                                                    disabled={acceptMutation.isPending}
                                                                    className="bg-[#808bf5] text-white border-0 rounded-xl px-4 py-1.5 text-[13px] font-bold cursor-pointer hover:bg-[#6366f1] transition-all transform active:scale-95"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDecline(e, n.sender.id || n.sender._id, n._id)}
                                                                    disabled={declineMutation.isPending}
                                                                    className="bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl px-4 py-1.5 text-[13px] font-bold cursor-pointer hover:bg-[var(--surface-3)] transition-all transform active:scale-95"
                                                                >
                                                                    Delete
                                                                </button>
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
                                                            <div className="w-2.5 h-2.5 rounded-full bg-[#808bf5] shadow-[0_0_8px_rgba(128,139,245,0.5)]" />
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
                ) : (
                    <div className="p-4 pb-20">
                        <CollabManager mode="invites" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
