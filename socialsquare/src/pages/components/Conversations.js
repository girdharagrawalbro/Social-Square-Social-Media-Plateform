import { useEffect, useState, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { socket } from '../../socket';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useConversations } from '../../hooks/queries/useConversationQueries';
import ChatPanel from './ChatPanel';

const Conversations = () => {
    const user = useAuthStore(s => s.user);
    const isOnline = useConversationStore(s => s.isOnline);
    const incrementUnread = useConversationStore(s => s.incrementUnread);
    const clearUnread = useConversationStore(s => s.clearUnread);
    const unreadCounts = useConversationStore(s => s.unreadCounts);
    const { data: conversations = [], refetch } = useConversations(user?._id);

    const [visible, setVisible] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [lastMessageId, setLastMessageId] = useState(null);

    const toId = (v) => (v && typeof v === 'object' && v.toString ? v.toString() : String(v || ''));

    // Memoize the refetch callback to prevent unnecessary effect re-runs
    const handleRefetch = useCallback(() => {
        refetch();
    }, [refetch]);

    // Socket: receive message → increment unread + refetch conversations
    useEffect(() => {
        const handleReceiveMessage = ({ conversationId, senderName, content }) => {
            incrementUnread(conversationId);
            handleRefetch();
        };

        socket.on('receiveMessage', handleReceiveMessage);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [handleRefetch, incrementUnread]);

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
        <div className="flex flex-col flex-1 min-h-0 glass-card rounded-2xl overflow-hidden transition-all duration-300">
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-md">
                <h5 className="font-semibold m-0 text-gray-800 dark:text-gray-100">Messages</h5>
                <div className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 pointer-events-none opacity-0">
                    <i className="pi pi-search text-xs"></i>
                </div>
            </div>

            <div className="flex flex-col gap-1 p-2 overflow-y-auto flex-1 custom-scrollbar scroll-smooth">
                {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 opacity-60">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                            <i className="pi pi-envelope text-gray-400"></i>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm text-center m-0">No conversations yet</p>
                    </div>
                ) : conversations.map((conv) => {
                    const myId = toId(user?._id);
                    const other = conv.participants?.find(p => toId(p.userId) !== myId);
                    if (!other) return null;
                    const convUnread = unreadCounts[conv._id] || 0;
                    const isUnread = toId(conv.lastMessageBy) !== myId && !conv.lastMessage?.isRead;

                    return (
                        <div key={conv._id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isUnread ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                            onClick={() => openChat({ ...other, userId: toId(other.userId), conversationId: conv._id }, conv.lastMessage?.id)}>
                            <div className="relative flex-shrink-0">
                                <img src={other.profilePicture || '/default-profile.png'} alt={other.fullname} className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-gray-800" />
                                {isOnline(other.userId) && (
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
                                )}
                            </div>
                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h6 className={`p-0 m-0 text-sm truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{other.fullname}</h6>
                                    <p className="text-gray-400 dark:text-gray-500 p-0 m-0 text-[10px] font-medium flex-shrink-0 ml-2">{formatDateTime(conv.lastMessageAt)}</p>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <p className={`p-0 m-0 text-xs truncate flex-1 ${isUnread ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {toId(conv.lastMessageBy) === myId ? 'You: ' : ''}{conv.lastMessage?.message || ''}
                                    </p>
                                    {convUnread > 0 && (
                                        <span className="bg-[#808bf5] text-white rounded-full min-w-[18px] h-[18px] px-1 text-[10px] flex items-center justify-center font-bold shadow-sm">
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
                breakpoints={{ '768px': '100vw' }} position="center" onHide={() => setVisible(false)}
                className="glass-card rounded-3xl"
                headerClassName="border-b border-gray-100 dark:border-gray-800"
            >
                {selectedParticipant && (
                    <ChatPanel participantId={selectedParticipant.userId} lastMessage={lastMessageId} />
                )}
            </Dialog>
        </div>
    );
};

export default Conversations;