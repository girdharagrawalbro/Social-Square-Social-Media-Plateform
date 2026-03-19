import React, { useRef, useState, useEffect } from 'react';
import { Badge } from 'primereact/badge';
import { useNotifications } from '../../../hooks/useNotifications';

export default function NotificationBell({ userId }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const { data: notifications = [], markRead, unreadCount } = useNotifications(userId);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = (id) => {
        markRead.mutate([id]);
    };

    const handleMarkAllRead = () => {
        const ids = notifications.map(n => n._id);
        if (ids.length) markRead.mutate(ids);
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
        if (n.type === 'message') return n.message?.content || 'sent you a message';
        if (n.type === 'like') return 'liked your post';
        if (n.type === 'comment') return 'commented on your post';
        if (n.type === 'follow') return 'started following you';
        return 'sent a notification';
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Bell Icon */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px' }}
            >
                <i className="pi pi-bell text-xl">
                    {unreadCount > 0 && <Badge value={unreadCount > 99 ? '99+' : unreadCount} severity="danger" />}
                </i>
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '40px',
                    width: '340px', background: '#fff',
                    borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    border: '1px solid #e5e7eb', zIndex: 1000, overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                                <i className="pi pi-bell-slash" style={{ fontSize: '2rem' }}></i>
                                <p style={{ marginTop: '8px' }}>No new notifications</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n._id}
                                    onClick={() => handleMarkRead(n._id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px 16px', cursor: 'pointer',
                                        background: n.read ? '#fff' : '#f5f3ff',
                                        borderBottom: '1px solid #f9fafb',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#f5f3ff'}
                                >
                                    <img
                                        src={n.sender?.profile_picture || '/default-profile.png'}
                                        alt=""
                                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '13px' }}>
                                            <strong>{n.sender?.fullname}</strong> {getNotificationText(n)}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                            {formatTime(n.createdAt)}
                                        </p>
                                    </div>
                                    {!n.read && (
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}