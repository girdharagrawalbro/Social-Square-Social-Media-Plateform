import React, { useRef, useState, useEffect } from 'react';
import { Badge } from 'primereact/badge';
import { useNotifications } from '../../../hooks/useNotifications';
import { useCollabInvites } from '../../../hooks/queries/useAuthQueries';
import CollabManager from '../CollabManager';
import usePostStore from '../../../store/zustand/usePostStore';
import useConversationStore from '../../../store/zustand/useConversationStore';
import { Dialog } from 'primereact/dialog';

export default function NotificationBell({ userId }) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'collabs'
    const ref = useRef(null);

    // ✅ TanStack Query - cached, deduplicated requests
    const { data: notifications = [], markRead, unreadCount } = useNotifications(userId);
    const { data: collabInvites = [] } = useCollabInvites(userId);

    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    const openChat = useConversationStore(s => s.openChat);
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
        if (n.type === 'message') return n.message?.content || 'sent you a message';
        if (n.type === 'like') return n.url?.includes('stories') ? 'liked your story' : 'liked your post';
        if (n.type === 'comment') return 'commented on your post';
        if (n.type === 'follow') return 'started following you';
        if (n.type === 'system') return n.message?.content || 'Security alert';
        return 'sent a notification';
    };

    const totalBadge = unreadCount + pendingCollabCount;

    return (
        <div ref={ref}>
            {/* Bell button */}
            <button onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', padding: '12px' }} className='text-dark bg-transparent border-none'>
                <span className="p-overlay-badge">
                    <i className="pi pi-bell text-xl"></i>
                    {totalBadge > 0 && <Badge value={totalBadge > 99 ? '99+' : totalBadge} severity="danger" />}
                </span>
            </button>

            <Dialog header="Notifications & Collabs" visible={open} style={{ width: '360px', height: '500px' }} onHide={() => setOpen(false)} modal={false} closable={false} draggable={false} resizable={false} contentStyle={{ padding: 0 }} position='center' className="notification-bell-dialog">
                <div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'notifications' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'notifications' ? '#808bf5' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            🔔 Notifications
                            {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{unreadCount}</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('collabs')}
                            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'collabs' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'collabs' ? '#808bf5' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            🤝 Collabs
                            {pendingCollabCount > 0 && <span style={{ background: '#808bf5', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{pendingCollabCount}</span>}
                        </button>
                    </div>

                    {/* Notifications tab */}
                    {activeTab === 'notifications' && (
                        <>
                            {unreadCount > 0 && (
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>
                                        Mark all as read
                                    </button>
                                </div>
                            )}
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
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
                                                setStoryDetailUserId(n.sender._id);
                                                setOpen(false);
                                            } else if (n.post) {
                                                setPostDetailId(n.post);
                                                setOpen(false);
                                            }
                                        }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: n.read ? '#fff' : '#f5f3ff', borderBottom: '1px solid #f9fafb', transition: 'background 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                            onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#f5f3ff'}>
                                            <img 
                                                src={n.sender?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`} 
                                                alt="" 
                                                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #f3f4f6' }} 
                                                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(n.sender?.fullname || 'U')}&background=808bf5&color=fff`; }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: '13px' }}>
                                                    <strong>{n.sender?.fullname}</strong> {getNotificationText(n)}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>{formatTime(n.createdAt)}</p>
                                            </div>
                                            {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                                        </div>
                                    ))
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
        </div>
    );
}