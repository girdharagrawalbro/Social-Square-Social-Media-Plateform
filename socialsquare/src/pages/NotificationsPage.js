import React, { useMemo } from 'react';
import useAuthStore from '../store/zustand/useAuthStore';
import { useNotifications } from '../hooks/useNotifications';
import { useCollabInvites, useAcceptFollowRequest, useDeclineFollowRequest } from '../hooks/queries/useAuthQueries';
import usePostStore from '../store/zustand/usePostStore';
import useConversationStore from '../store/zustand/useConversationStore';
import { useNavigate } from 'react-router-dom';

const NotificationsPage = () => {
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();

    const { data: notifications = [], markRead, loadMore, hasMore, isLoading } = useNotifications(user?._id);
    const { data: collabInvites = [] } = useCollabInvites(user?._id);
    
    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    const openChat = useConversationStore(s => s.openChat);
    const acceptMutation = useAcceptFollowRequest();
    const declineMutation = useDeclineFollowRequest();

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
                <div className="sticky top-16 z-20 bg-[var(--surface-1)] bg-opacity-90 backdrop-blur-md border-b border-[var(--border-color)] p-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold m-0 text-[var(--text-main)]">Notifications</h2>
                </div>

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
                            <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--surface-1)]">
                                <h3 className="text-sm font-bold text-[var(--text-main)] mb-2 uppercase">Collab Requests</h3>
                                <button className="w-full text-left bg-transparent border-0 cursor-pointer flex items-center justify-between text-[#808bf5] font-semibold">
                                    <span>You have {collabInvites.length} pending collab request{collabInvites.length > 1 ? 's' : ''}</span>
                                    <i className="pi pi-chevron-right text-xs"></i>
                                </button>
                            </div>
                        )}

                        {/* Render Grouped Notifications */}
                        {groupedNotifications.map(([groupName, items]) => (
                            <div key={groupName}>
                                <div className="px-4 pt-4 pb-2">
                                    <h3 className="text-[15px] font-bold text-[var(--text-main)] m-0">{groupName}</h3>
                                </div>
                                <div>
                                    {items.map(n => (
                                        <div 
                                            key={n._id}
                                            onClick={() => {
                                                handleMarkRead(n._id);
                                                if (n.type === 'message' && n.message?.conversationId) {
                                                    openChat(n.message.conversationId, n.sender);
                                                } else if (n.type === 'like' && n.story) {
                                                    setStoryDetailUserId(n.sender._id);
                                                } else if (n.post) {
                                                    setPostDetailId(n.post);
                                                } else if (n.type === 'follow') {
                                                    navigate(`/profile/${n.sender._id}`);
                                                }
                                            }}
                                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${!n.read ? 'bg-[#ede9fe] dark:bg-[#808bf5] dark:bg-opacity-10' : 'hover:bg-[var(--surface-1)]'}`}
                                        >
                                            <img
                                                src={n.sender?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`}
                                                alt=""
                                                className="w-11 h-11 rounded-full object-cover border border-[var(--border-color)]"
                                                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`; }}
                                            />
                                            
                                            <div className="flex-1 min-w-0 pr-2">
                                                <p className="m-0 text-[14px] text-[var(--text-main)] leading-tight">
                                                    <span className="font-bold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${n.sender._id}`); }}>
                                                        {n.sender?.username || n.sender?.fullname}
                                                    </span>{' '}
                                                    <span className="text-[var(--text-main)]">{getNotificationText(n)}</span>{' '}
                                                    <span className="text-[var(--text-sub)] text-[13px]">{formatTime(n.createdAt)}</span>
                                                </p>

                                                {n.type === 'follow_request' && !n.read && (
                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={(e) => handleAccept(e, n.sender.id, n._id)}
                                                            disabled={acceptMutation.isPending}
                                                            className="bg-[#808bf5] text-white border-0 rounded-lg px-5 py-1.5 text-[14px] font-semibold cursor-pointer hover:bg-[#6366f1] transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDecline(e, n.sender.id, n._id)}
                                                            disabled={declineMutation.isPending}
                                                            className="bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg px-5 py-1.5 text-[14px] font-semibold cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Trailing item: unread dot or thumbnail image */}
                                            <div className="flex items-center justify-center pt-1 shrink-0">
                                                {n.thumbnail ? (
                                                    <img
                                                        src={n.thumbnail}
                                                        alt=""
                                                        className="w-11 h-11 rounded-md object-cover border border-[var(--border-color)]"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : !n.read && n.type !== 'follow_request' ? (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {hasMore && (
                            <div className="p-4 text-center">
                                <button
                                    onClick={() => loadMore()}
                                    disabled={isLoading}
                                    className="bg-transparent border-0 text-[#808bf5] text-sm font-semibold cursor-pointer"
                                >
                                    {isLoading ? 'Loading...' : 'Load more activity'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
