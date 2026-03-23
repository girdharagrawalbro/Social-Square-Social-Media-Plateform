import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Badge } from 'primereact/badge';
import { socket } from '../../socket';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useConversations } from '../../hooks/queries/useConversationQueries';
import { useNotifications } from '../../hooks/queries/useNotificationQueries';
import ChatPanel from './ChatPanel';

const Conversations = () => {
    const user = useAuthStore(s => s.user);
    const isOnline = useConversationStore(s => s.isOnline);
    const incrementUnread = useConversationStore(s => s.incrementUnread);
    const clearUnread = useConversationStore(s => s.clearUnread);
    const unreadCounts = useConversationStore(s => s.unreadCounts);
    const totalUnread = useConversationStore(s => s.totalUnread);
    const setOnlineUsers = useConversationStore(s => s.setOnlineUsers);

    const { data: conversations = [], refetch } = useConversations(user?._id);
    const { data: notifications = [], unreadCount, markRead } = useNotifications(user?._id);

    const [visible, setVisible] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [lastMessageId, setLastMessageId] = useState(null);
    const [notifVisible, setNotifVisible] = useState(false);

    // Socket: receive message → increment unread + refetch conversations
    useEffect(() => {
        socket.on('receiveMessage', ({ conversationId, senderName, content }) => {
            incrementUnread(conversationId);
            refetch();
        });
        socket.on('updateUserList', setOnlineUsers);
        return () => {
            socket.off('receiveMessage');
            socket.off('updateUserList');
        };
    }, []);

    const openChat = (participant, lastMsgId) => {
        setSelectedParticipant(participant);
        setLastMessageId(lastMsgId);
        setVisible(true);
        clearUnread(participant.conversationId);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const diff = Date.now() - new Date(dateString);
        if (diff < 86400000) return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return new Date(dateString).toLocaleDateString();
    };

    const headerElement = selectedParticipant && (
        <div className="flex items-center gap-2">
            <div className="relative">
                <img src={selectedParticipant.profilePicture || '/default-profile.png'} className="w-8 h-8 rounded-full object-cover" alt="" />
                {isOnline(selectedParticipant.userId) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                )}
            </div>
            <div>
                <span className="font-semibold text-sm">{selectedParticipant.fullname}</span>
                <p className="m-0 text-xs text-gray-400">{isOnline(selectedParticipant.userId) ? '🟢 Online' : 'Offline'}</p>
            </div>
        </div>
    );

    return (
        <div className="p-3 bordershadow bg-white rounded conversations">
            <div className="flex justify-between items-center mb-3">
                <h5 className="font-medium m-0">Messages</h5>
                <div className="flex gap-2 items-center">
                    {totalUnread() > 0 && (
                        <span style={{ background: '#808bf5', color: '#fff', borderRadius: '12px', fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
                            {totalUnread()}
                        </span>
                    )}
                    <button
                        onClick={() => setNotifVisible(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px' }}
                    >
                        <i className="pi pi-bell" style={{ fontSize: '1.3rem' }}>
                            {unreadCount > 0 && <Badge value={unreadCount} severity="danger" />}
                        </i>
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2 h-[calc(100vh-150px)] overflow-y-auto">
                {conversations.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-3">No conversations yet</p>
                ) : conversations.map((conv) => {
                    const other = conv.participants?.find(p => p.userId !== user?._id);
                    if (!other) return null;
                    const convUnread = unreadCounts[conv._id] || 0;
                    const isUnread = conv.lastMessageBy !== user?._id && !conv.lastMessage?.isRead;

                    return (
                        <div key={conv._id}
                            className="flex items-center gap-2 mt-1 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition"
                            onClick={() => openChat({ ...other, conversationId: conv._id }, conv.lastMessage?.id)}>
                            <div className="relative flex-shrink-0">
                                <img src={other.profilePicture || '/default-profile.png'} alt={other.fullname} className="w-10 h-10 rounded-full object-cover" />
                                {isOnline(other.userId) && (
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                                )}
                            </div>
                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h6 className={`p-0 m-0 text-sm ${isUnread ? 'font-bold' : 'font-medium'}`}>{other.fullname}</h6>
                                    <p className="text-gray-400 p-0 m-0 text-xs flex-shrink-0">{formatDateTime(conv.lastMessageAt)}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={`p-0 m-0 text-xs truncate ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                        {conv.lastMessageBy === user?._id ? 'You: ' : ''}{conv.lastMessage?.message || ''}
                                    </p>
                                    {convUnread > 0 && (
                                        <span style={{ background: '#808bf5', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>
                                            {convUnread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Chat Dialog */}
            <Dialog header={headerElement} visible={visible} style={{ width: '95vw', maxWidth: '500px', height: '90vh' }}
                breakpoints={{ '768px': '100vw' }} position="center" onHide={() => setVisible(false)}>
                {selectedParticipant && (
                    <ChatPanel participantId={selectedParticipant.userId} lastMessage={lastMessageId} />
                )}
            </Dialog>

            {/* Notifications Dialog - Message type only */}
            {(() => {
                const messageNotifications = notifications.filter(n => n.type === 'message');
                return (
                    <Dialog header="Notifications" visible={notifVisible} style={{ width: '95vw', maxWidth: '360px', height: '100vh' }} position="right"
                        onHide={() => {
                            setNotifVisible(false);
                            const unread = messageNotifications.filter(n => !n.read).map(n => n._id);
                            if (unread.length) markRead.mutate(unread);
                        }}>
                        <div className="flex flex-col gap-2 p-2">
                            {messageNotifications.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm py-6">No message notifications</p>
                            ) : messageNotifications.map(n => (
                                <div key={n._id} style={{ background: n.read ? '#fff' : '#f5f3ff', borderRadius: '10px', padding: '10px 12px', border: '1px solid #f3f4f6' }}>
                                    <div className="flex items-center gap-2">
                                        <img src={n.sender?.profile_picture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm m-0 font-medium">{n.sender?.fullname}</p>
                                            <p className="text-xs text-gray-500 m-0">{n.message?.content || 'sent a message'}</p>
                                        </div>
                                        {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#808bf5', flexShrink: 0 }} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Dialog>
                );
            })()}
        </div>
    );
};

export default Conversations;