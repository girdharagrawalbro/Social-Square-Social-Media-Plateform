import React, { useRef, useState, useEffect } from 'react';
import { Badge } from 'primereact/badge';
import { useNotifications } from '../../../hooks/useNotifications';
import { useCollabInvites, useAcceptFollowRequest, useDeclineFollowRequest } from '../../../hooks/queries/useAuthQueries';
import CollabManager from '../CollabManager';
import usePostStore from '../../../store/zustand/usePostStore';
import useConversationStore from '../../../store/zustand/useConversationStore';
import { Dialog } from 'primereact/dialog';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../../context/DarkModeContext';

export default function NotificationBell({ userId, useRoute = false, showLabel = true }) {
    const { isDark } = useDarkMode();
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'collabs'
    const ref = useRef(null);
    const navigate = useNavigate();

    // ✅ TanStack Query - cached, deduplicated requests
    const { data: notifications = [], markRead, unreadCount, loadMore, hasMore, isLoading } = useNotifications(userId);
    const { data: collabInvites = [] } = useCollabInvites(userId);

    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    const openChat = useConversationStore(s => s.openChat);
    const acceptMutation = useAcceptFollowRequest();
    const declineMutation = useDeclineFollowRequest();
    const pendingCollabCount = collabInvites.length;

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            const target = e.target;
            const clickedBell = ref.current && ref.current.contains(target);
            const clickedDialog = target?.closest && target.closest('.notification-bell-dialog');
            if (!clickedBell && !clickedDialog) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = (id) => markRead.mutate([id]);
    const handleMarkAllRead = () => { const ids = notifications.map(n => n._id); if (ids.length) markRead.mutate(ids); };

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

    const formatTime = (dateString) => {
        const diff = Date.now() - new Date(dateString);
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return new Date(dateString).toLocaleDateString();
    };

    const getNotificationText = (n) => {
        if (n.type === 'new_post') return 'created a new post';
        if (n.type === 'collab_invite') return 'invited you to collaborate';
        if (n.type === 'message') return n.message?.content || 'sent you a message';
        if (n.type === 'like') return n.url?.includes('stories') ? 'liked your story' : 'liked your post';
        if (n.type === 'comment') return 'commented on your post';
        if (n.type === 'follow') return 'started following you';
        if (n.type === 'follow_request') return 'sent you a follow request';
        if (n.type === 'system') return n.message?.content || 'Security alert';
        return 'sent a notification';
    };

    const totalBadge = unreadCount + pendingCollabCount;

    return (
        <div ref={ref}>
            {/* Bell button */}
            <button 
                onClick={() => useRoute ? navigate('/notifications') : setOpen(o => !o)} 
                className={`flex items-center justify-center md:justify-start gap-0 md:gap-3 
                           w-9 h-9 md:w-auto md:h-auto
                           p-0 md:px-4 md:py-3 
                           rounded-full md:rounded-lg 
                           transition-all hover:bg-gray-100 dark:hover:bg-gray-800 
                           ${isDark ? 'bg-gray-700 md:bg-transparent text-white' : 'bg-gray-100 md:bg-transparent text-gray-800'}`}
            >
                <span className="p-overlay-badge flex items-center justify-center">
                    <i className="pi pi-bell text-xl"></i>
                    {totalBadge > 0 && <Badge value={totalBadge > 99 ? '99+' : totalBadge} style={{ background: '#ef4444 !important', color: '#fff !important', backgroundColor: '#ef4444' }} className="!bg-red-500 !text-white" />}
                </span>
                {showLabel && <span className='font-medium text-base hidden md:inline-block'>Notifications</span>}
            </button>

            {!useRoute && (
                <Dialog header="Notifications & Collabs" visible={open} style={{ width: '360px', height: '500px' }} onHide={() => setOpen(false)} modal={false} closable={false} draggable={false} resizable={false} contentStyle={{ padding: 0 }} position='center' className="notification-bell-dialog border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-1)' }}>
                            <button
                                onClick={() => setActiveTab('notifications')}
                                style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'notifications' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'notifications' ? '#808bf5' : 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                🔔 Notifications
                                {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{unreadCount}</span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('collabs')}
                                style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'collabs' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'collabs' ? '#808bf5' : 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                🤝 Collabs
                                {pendingCollabCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{pendingCollabCount}</span>}
                            </button>
                        </div>

                        {/* Notifications tab */}
                        {activeTab === 'notifications' && (
                            <>
                                {unreadCount > 0 && (
                                    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--surface-1)' }}>
                                        <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#808bf5', fontWeight: 600 }}>
                                            Mark all as read
                                        </button>
                                    </div>
                                )}
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-sub)' }}>
                                            <i className="pi pi-bell-slash" style={{ fontSize: '2rem' }}></i>
                                            <p style={{ marginTop: '8px', margin: '8px 0 0', fontSize: '13px' }}>No new notifications</p>
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div key={n._id} onClick={() => {
                                                handleMarkRead(n._id);
                                                if (n.type === 'message' && n.message?.conversationId) {
                                                    openChat(n.message.conversationId, n.sender);
                                                    setOpen(false);
                                                } else if (n.type === 'like' && n.story) {
                                                    setStoryDetailUserId(n.sender.id || n.sender._id);
                                                    setOpen(false);
                                                } else if (n.post) {
                                                    setPostDetailId(n.post);
                                                    setOpen(false);
                                                } else if (n.type === 'collab_invite') {
                                                    setActiveTab('collabs');
                                                }
                                            }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: n.read ? 'var(--surface-1)' : 'var(--surface-2)', borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                                                onMouseLeave={e => e.currentTarget.style.background = n.read ? 'var(--surface-1)' : 'var(--surface-2)'}>
                                                <img
                                                    src={n.sender?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`}
                                                    alt=""
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const id = n.sender?.id || n.sender?._id;
                                                        if (id) navigate(`/profile/${id}`);
                                                        setOpen(false);
                                                    }}
                                                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`; }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>
                                                        <strong
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const id = n.sender?.id || n.sender?._id;
                                                                if (id) navigate(`/profile/${id}`);
                                                                setOpen(false);
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                            className="hover:text-indigo-600 transition-colors"
                                                        >
                                                            {n.sender?.fullname}
                                                        </strong> {getNotificationText(n)}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-sub)' }}>{formatTime(n.createdAt)}</p>
                                                    {n.type === 'follow_request' && !n.read && (
                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                            <button
                                                                onClick={(e) => handleAccept(e, n.sender.id || n.sender._id, n._id)}
                                                                disabled={acceptMutation.isPending}
                                                                style={{ background: '#808bf5', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                                                {acceptMutation.isPending ? 'Accepting...' : 'Accept'}
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDecline(e, n.sender.id || n.sender._id, n._id)}
                                                                disabled={declineMutation.isPending}
                                                                style={{ background: 'var(--surface-2)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                                                Decline
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {n.thumbnail && (
                                                    <img
                                                        src={n.thumbnail}
                                                        alt=""
                                                        style={{ width: 36, height: 36, borderRadius: '6px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-color)' }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                )}
                                                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                                            </div>
                                        ))
                                    )}
                                    {hasMore && (
                                        <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); loadMore(); }}
                                                disabled={isLoading}
                                                style={{ background: 'none', border: 'none', color: '#808bf5', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                                {isLoading ? 'Loading...' : 'Load more history'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Collabs tab */}
                        {activeTab === 'collabs' && (
                            <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '12px' }}>
                                <CollabManager mode="invites" compact />
                            </div>
                        )}
                    </div>
                </Dialog>
            )}
        </div>
    );
}