import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { Badge } from 'primereact/badge';
import { useNotifications } from '../../../hooks/useNotifications';
import { useCollabInvites, useAcceptFollowRequest, useDeclineFollowRequest } from '../../../hooks/queries/useAuthQueries';
import CollabManager from '../CollabManager';
import usePostStore from '../../../store/zustand/usePostStore';
import useConversationStore from '../../../store/zustand/useConversationStore';
import { Dialog } from 'primereact/dialog';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../../context/DarkModeContext';

const NotificationBell = forwardRef(({ userId, useRoute = false, showLabel = true, active = false }, forwardedRef) => {
    const { isDark } = useDarkMode();
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'collabs' | 'requests'
    const localRef = useRef(null);
    const navigate = useNavigate();

    // ✅ Sync with Global Store via hook
    const { data: notifications = [], markRead, loadMore, hasMore, isLoading } = useNotifications(userId);
    const { data: collabInvites = [] } = useCollabInvites(userId);
    const { unreadNotificationsCount: globalUnreadCount } = useConversationStore();

    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    // Filter follow request notifications for the Requests tab
    const followRequests = notifications.filter(n => n.type === 'follow_request');
    const acceptMutation = useAcceptFollowRequest();
    const declineMutation = useDeclineFollowRequest();
    const pendingCollabCount = collabInvites.length;

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            const target = e.target;
            const clickedBell = localRef.current && localRef.current.contains(target);
            const clickedDialog = target?.closest && target.closest('.notification-bell-dialog');
            if (!clickedBell && !clickedDialog) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ✅ Auto-mark as read when opening popup
    // useEffect(() => {
    //     if (open && activeTab === 'notifications') {
    //         const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
    //         if (unreadIds.length > 0) {
    //             markRead.mutate(unreadIds);
    //         }
    //     }
    // }, [open, activeTab, notifications, markRead]);

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
        if (n.type === 'follow_accept') return 'accepted your follow request';
        if (n.type === 'follow_decline') return 'declined your follow request';
        if (n.type === 'livestream') return n.message?.content || 'is currently live';
        if (n.type === 'system') return n.message?.content || 'Security alert';
        if (n.type === 'announcement') return n.message?.content || 'New announcement';
        return 'sent a notification';
    };

    const totalBadge = globalUnreadCount + pendingCollabCount;

    const activeClass = "bg-gradient-to-tr from-[#808bf5] via-[#6366f1] to-[#4f46e5] text-white font-bold shadow-lg shadow-indigo-500/40 relative overflow-hidden";
    const inactiveClass = `hover:bg-gray-100 dark:hover:bg-neutral-900 ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-gray-800'}`;

    const setRefs = (el) => {
        localRef.current = el;
        if (typeof forwardedRef === 'function') {
            forwardedRef(el);
        } else if (forwardedRef) {
            forwardedRef.current = el;
        }
    };

    return (
        <div ref={setRefs}>
            {/* Bell button */}
            <button
                onClick={() => useRoute ? navigate('/notifications') : setOpen(o => !o)}
                className={`flex items-center ${showLabel ? 'justify-start gap-2 px-4 w-full' : 'justify-center px-0 w-12'} 
                           h-12
                           rounded-full 
                           transition-all 
                           ${active ? activeClass : inactiveClass} border-0 cursor-pointer`}
                title="Notifications"
            >
                {active && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
                <div className="relative flex items-center justify-center w-6 shrink-0 z-10">
                    <i className="pi pi-bell text-xl"></i>
                    {totalBadge > 0 && (
                        <Badge
                            value={totalBadge > 99 ? '99+' : totalBadge}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 py-2 !min-w-[16px] !h-[16px] !text-[9px] flex items-center justify-center border-2 dark:border-[#0d0d0d] dark:bg-red-600 border-white font-bold"
                        />
                    )}
                </div>
                {showLabel && <span className='hidden md:inline font-medium text-base whitespace-nowrap ml-3 z-10'>Notifications</span>}
            </button>

            {!useRoute && (
                <Dialog header="Notifications & Collabs" visible={open} style={{ width: '360px', height: '515px' }} onHide={() => setOpen(false)} modal={false} closable={false} draggable={false} resizable={false} contentStyle={{ padding: 0 }} position='center' className="notification-bell-dialog border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex flex-col h-full bg-[var(--surface-1)]">
                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-1)' }}>
                            <button
                                onClick={() => setActiveTab('notifications')}
                                style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'notifications' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'notifications' ? '#808bf5' : 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                🔔 <br /> Notifications
                                {globalUnreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{globalUnreadCount}</span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('requests')}
                                style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'requests' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'requests' ? '#808bf5' : 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                🙋‍♂️ <br /> Requests
                                {followRequests.filter(r => !r.read).length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{followRequests.filter(r => !r.read).length}</span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('collabs')}
                                style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'collabs' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'collabs' ? '#808bf5' : 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                🤝 <br />Collabs
                                {pendingCollabCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{pendingCollabCount}</span>}
                            </button>
                        </div>

                        {/* Notifications tab */}
                        {activeTab === 'notifications' && (
                            <div className="flex flex-col h-full">
                                {globalUnreadCount > 0 && (
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
                                        notifications.filter(n => n.type !== 'follow_request' || (n.status === 'pending' || !n.status)).map(n => (
                                            <div key={n._id} onClick={() => {
                                                handleMarkRead(n._id);
                                                if (n.type === 'message' && n.sender) {
                                                    const targetId = n.sender.id || n.sender._id;
                                                    if (targetId) navigate(`/conversation/${targetId}`);
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
                                                className={`flex items-center gap-3 py-3 px-3 cursor-pointer border-b border-[var(--border-color)] transition-all duration-200 ${!n.read
                                                    ? 'bg-gray-100 hover:bg-gray-200/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60'
                                                    : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
                                                    }`}
                                            >

                                                <img
                                                    src={n.type === 'system' ? 'https://img.icons8.com/fluency/96/shield.png' : n.type === 'announcement' ? 'https://img.icons8.com/fluency/96/megaphone.png' : n.type === 'livestream' ? 'https://img.icons8.com/fluency/96/camera.png' : (n.sender?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg')}
                                                    alt=""
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const id = n.sender?.id || n.sender?._id;
                                                        if (id && n.type !== 'system' && n.type !== 'announcement' && n.type !== 'livestream') navigate(`/profile/${id}`);
                                                        if (!id || (n.type !== 'system' && n.type !== 'announcement' && n.type !== 'livestream')) setOpen(false);
                                                    }}
                                                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                                    onError={(e) => { e.target.src = 'https://th.bing.com/th/id/OIP.S171c9HYsokH'; }}
                                                />

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>
                                                        <strong
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const id = n.sender?.id || n.sender?._id;
                                                                if (id && n.type !== 'system' && n.type !== 'announcement' && n.type !== 'livestream') navigate(`/profile/${id}`);
                                                                if (!id || (n.type !== 'system' && n.type !== 'announcement' && n.type !== 'livestream')) setOpen(false);
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                            className="hover:text-indigo-600 transition-colors"
                                                        >
                                                            {n.type === 'system' ? 'Security Alert' : n.type === 'announcement' ? 'System Announcement' : n.type === 'livestream' ? 'Live Stream' : n.sender?.fullname}
                                                        </strong> {getNotificationText(n)}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-sub)' }}>{formatTime(n.createdAt)}</p>
                                                    {n.type === 'follow_request' && (
                                                        <div style={{ marginTop: '8px' }}>
                                                            {n.status === 'accepted' ? (
                                                                <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700, background: '#10b98110', padding: '4px 10px', borderRadius: '6px' }}>✓ Accepted</span>
                                                            ) : n.status === 'declined' ? (
                                                                <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 700, background: '#ef444410', padding: '4px 10px', borderRadius: '6px' }}>✕ Declined</span>
                                                            ) : !n.read && (
                                                                <div style={{ display: 'flex', gap: '8px' }}>
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

                            </div>
                        )}

                        {/* Requests tab */}
                        {activeTab === 'requests' && (
                            <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '12px' }}>
                                {followRequests.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-sub)' }}>
                                        <i className="pi pi-user-plus" style={{ fontSize: '2rem' }}></i>
                                        <p style={{ marginTop: '8px', fontSize: '13px' }}>No follow requests</p>
                                    </div>
                                ) : (
                                    followRequests.map(n => (
                                        <div key={n._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', cursor: 'pointer', background: n.read ? 'var(--surface-1)' : 'var(--surface-2)', borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onClick={() => { handleMarkRead(n._id); }}>
                                            <img src={n.type === 'system' ? 'https://img.icons8.com/fluency/96/shield.png' : n.type === 'announcement' ? 'https://img.icons8.com/fluency/96/megaphone.png' : (n.sender?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg')} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-color)' }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>
                                                    <strong onClick={(e) => { e.stopPropagation(); const id = n.sender?.id || n.sender?._id; if (id) navigate(`/profile/${id}`); }} className="hover:text-indigo-600 transition-colors" style={{ cursor: 'pointer' }}>{n.sender?.fullname}</strong> {getNotificationText(n)}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-sub)' }}>{formatTime(n.createdAt)}</p>
                                                {n.type === 'follow_request' && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        {n.status === 'accepted' ? (
                                                            <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700, background: '#10b98110', padding: '4px 10px', borderRadius: '6px' }}>✓ Accepted</span>
                                                        ) : n.status === 'declined' ? (
                                                            <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 700, background: '#ef444410', padding: '4px 10px', borderRadius: '6px' }}>✕ Declined</span>
                                                        ) : !n.read && (
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={(e) => handleAccept(e, n.sender.id || n.sender._id, n._id)} disabled={acceptMutation.isPending} style={{ background: '#808bf5', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{acceptMutation.isPending ? 'Accepting...' : 'Accept'}</button>
                                                                <button onClick={(e) => handleDecline(e, n.sender.id || n.sender._id, n._id)} disabled={declineMutation.isPending} style={{ background: 'var(--surface-2)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Decline</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {/* Collabs tab */}
                        {activeTab === 'collabs' && (
                            <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '12px' }}>
                                <CollabManager mode="invites" compact />
                            </div>
                        )}

                        <div className='absoulte bottom-10 p-2  bg-[--surface-1] flex justsify-center' >
                            <button
                                onClick={() => {
                                    navigate('/notifications');
                                    setOpen(false);
                                }}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 hover:from-indigo-500/15 hover:to-blue-500/15 text-[#808bf5] border-0 rounded-2xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all active:scale-[0.98]"
                            >
                                See complete notifications
                            </button>
                        </div>
                    </div>
                </Dialog>
            )}
        </div>
    );
});

export default NotificationBell;
