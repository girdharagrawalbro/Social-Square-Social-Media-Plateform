import { useEffect, useState, useCallback } from 'react';
import { socket } from '../../socket';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useConversations, useClearChat, useDeleteChat } from '../../hooks/queries/useConversationQueries';
import { useSearchUsers } from '../../hooks/queries/useExploreQueries';
import ChatPanel from './ChatPanel';
import UserProfile from './UserProfile';
import formatDate from '../../utils/formatDate';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';

const Conversations = () => {
    const user = useAuthStore(s => s.user);
    const isOnline = useConversationStore(s => s.isOnline);
    const getLastSeen = useConversationStore(s => s.getLastSeen);
    const incrementUnread = useConversationStore(s => s.incrementUnread);
    const clearUnread = useConversationStore(s => s.clearUnread);
    const unreadCounts = useConversationStore(s => s.unreadCounts);
    const { data: conversations = [], refetch } = useConversations(user?._id);

    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const openChatGlobal = useConversationStore(s => s.openChat);
    const closeChatGlobal = useConversationStore(s => s.closeChat);
    const activeParticipant = useConversationStore(s => s.activeParticipant);

    // Sync local selectedParticipant with global activeParticipant on mount if needed
    useEffect(() => {
        if (activeParticipant && !selectedParticipant) {
            setSelectedParticipant(activeParticipant);
        }
    }, [activeParticipant, selectedParticipant]);

    const [lastMessageId, setLastMessageId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);


    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [globalSearch, setGlobalSearch] = useState('');
    const { data: searchResults = [], isLoading: isSearchingGlobal } = useSearchUsers(globalSearch);

    const [isSearching, setIsSearching] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [searchIndex, setSearchIndex] = useState(0);
    const [searchCount, setSearchCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showMenu, setShowMenu] = useState(false);

    const clearChatMut = useClearChat();
    const deleteChatMut = useDeleteChat();

    // ✅ Auto-close search when switching chats
    useEffect(() => {
        setIsSearching(false);
        setSearchQ('');
        setSearchIndex(0);
        setSearchCount(0);
        setProfileVisible(false);
    }, [selectedParticipant?.userId]);


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
        clearUnread(participant.conversationId);
        openChatGlobal(participant.conversationId, participant);
    };

    const handleProfileClick = (userId) => {
        setSelectedUserId(userId);
        setProfileVisible(true);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const diff = Date.now() - new Date(dateString);
        if (diff < 86400000) return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return new Date(dateString).toLocaleDateString();
    };

    const [searchQuery, setSearchQuery] = useState('');
    const filteredConversations = conversations.filter(conv => {
        const myId = toId(user?._id);
        const other = conv.participants?.find(p => toId(p.userId) !== myId);
        return other?.fullname?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="flex flex-col flex-1 min-h-0 glass-card overflow-hidden transition-all duration-300" style={{ height: 'calc(100vh - 10px)' }}>
            <div className="flex flex-1 min-h-0">
                {/* Conversation list - left column */}
                <div className={`w-full sm:w-80 md:w-[30rem] border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden ${selectedParticipant ? 'hidden sm:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-gray-50 dark:border-gray-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="m-0 text-xl font-black text-[var(--text-main)]">Messages</h2>
                            <button
                                onClick={() => setIsComposeOpen(true)}
                                className="w-9 h-9 flex items-center justify-center bg-[#808bf5]/10 text-[#808bf5] rounded-full border-0 cursor-pointer hover:bg-[#808bf5] hover:text-white transition-all duration-200"
                                title="New Message"
                            >
                                <i className="pi pi-plus text-xs font-bold"></i>
                            </button>
                        </div>
                        <div className="relative">
                            <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                            <input
                                type="text"
                                placeholder="Search people..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl py-2 pl-9 pr-4 text-xs text-[var(--text-main)] focus:ring-2 ring-indigo-500/20 outline-none transition"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {filteredConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 opacity-60">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                    <i className={`pi ${searchQuery ? 'pi-search' : 'pi-envelope'} text-gray-400`}></i>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center m-0 font-medium">
                                    {searchQuery ? 'No results found' : 'No conversations yet'}
                                </p>
                            </div>
                        ) : filteredConversations.map((conv) => {
                            const myId = toId(user?._id);
                            const other = conv.participants?.find(p => toId(p.userId) !== myId);
                            if (!other) return null;
                            const convUnread = unreadCounts[conv._id] || 0;
                            const isUnread = toId(conv.lastMessageBy) !== myId && !conv.lastMessage?.isRead;

                            return (
                                <div key={conv._id}
                                    className={`flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 ${isUnread ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : 'hover:bg-gray-50/80 dark:hover:bg-neutral-900/40'}`}
                                    onClick={() => openChat({ ...other, userId: toId(other.userId), conversationId: conv._id }, conv.lastMessage?.id)}>
                                    <div className="relative flex-shrink-0">
                                        <img src={other.profilePicture || '/default-profile.png'} alt={other.fullname} className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-transparent group-hover:border-[#808bf5]/30 transition-all" />
                                        {isOnline(other.userId) && (
                                            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm" />
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h6 className={`p-0 m-0 text-[15px] truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'}`}>{other.fullname}</h6>
                                            <p className="text-gray-400 dark:text-gray-500 p-0 m-0 text-[11px] font-medium flex-shrink-0 ml-2">{formatDateTime(conv.lastMessageAt)}</p>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <p className={`p-0 m-0 text-sm truncate flex-1 leading-tight ${isUnread ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 font-normal'}`}>
                                                {toId(conv.lastMessageBy) === myId ? <span className="text-[#808bf5] font-bold mr-1">You:</span> : ''}{conv.lastMessage?.message || ''}
                                            </p>
                                            {convUnread > 0 && (
                                                <span className="bg-[#808bf5] text-white rounded-full min-w-[20px] h-[20px] px-1.5 text-[11px] flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
                                                    {convUnread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chat panel - middle column */}
                <div className={`flex-1 flex flex-col min-h-0 h-full ${selectedParticipant ? 'flex' : 'hidden sm:flex'}`}>
                    {selectedParticipant ? (
                        <div className="flex flex-col flex-1 min-h-0 h-full">
                            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between min-h-[64px] bg-white/80 dark:bg-black/80 backdrop-blur-md">
                                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleProfileClick(selectedParticipant.userId)}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedParticipant(null); closeChatGlobal(); }}
                                        className="sm:hidden -ml-2 p-2 rounded-full border-0 bg-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center"
                                    >
                                        <i className="pi pi-chevron-left text-lg"></i>
                                    </button>
                                    <div className="relative">
                                        <img src={selectedParticipant.profilePicture || '/default-profile.png'} className="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 group-hover:ring-indigo-200 transition-all font-bold" alt="" />
                                        {isOnline(selectedParticipant.userId) && (
                                            <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-950" />
                                        )}
                                    </div>
                                    <div className={`${isSearching ? 'hidden sm:block' : ''}`}>
                                        <div className="font-black text-sm text-[var(--text-main)] group-hover:text-indigo-500 transition-colors leading-tight">{selectedParticipant.fullname}</div>
                                        {!isSearching && (
                                            <div className="text-[10px] font-medium text-gray-400 mt-0.5">
                                                {isOnline(selectedParticipant.userId) ? <span className="text-green-500">Online</span> : `Last seen ${formatDate(getLastSeen(selectedParticipant.userId)) || 'recently'}`}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isSearching ? (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="relative">
                                                <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-[10px]"></i>
                                                <input
                                                    type="text"
                                                    placeholder="Find text..."
                                                    autoFocus
                                                    value={searchQ}
                                                    onChange={e => { setSearchQ(e.target.value); setSearchIndex(0); }}
                                                    className="w-40 sm:w-56 bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl py-2 pl-8 pr-16 text-xs text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/20 transition-all font-medium"
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pr-1">
                                                    {searchQ && searchCount > 0 && (
                                                        <div className="flex items-center gap-0.5">
                                                            <span className="text-[10px] text-indigo-500 font-black tracking-tighter opacity-80">{searchIndex + 1}/{searchCount}</span>
                                                            <button
                                                                onClick={() => setSearchIndex(prev => (prev + 1) % searchCount)}
                                                                className="w-5 h-5 flex items-center justify-center p-0 border-0 bg-transparent text-gray-400 hover:text-indigo-500 cursor-pointer transition-colors"
                                                                title="Previous match (Up)"
                                                            >
                                                                <i className="pi pi-chevron-up text-[10px]"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => setSearchIndex(prev => (prev - 1 + searchCount) % searchCount)}
                                                                className="w-5 h-5 flex items-center justify-center p-0 border-0 bg-transparent text-gray-400 hover:text-indigo-500 cursor-pointer transition-colors"
                                                                title="Next match (Down)"
                                                            >
                                                                <i className="pi pi-chevron-down text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                    {searchQ && (
                                                        <button onClick={() => { setSearchQ(''); setSearchIndex(0); setSearchCount(0); }} className="border-0 bg-transparent text-gray-400 hover:text-gray-600 cursor-pointer p-0 flex">
                                                            <i className="pi pi-times-circle text-[11px]"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setIsSearching(false); setSearchQ(''); }}
                                                className="bg-transparent border-0 text-gray-400 text-[11px] font-black uppercase tracking-wider cursor-pointer hover:text-indigo-500 px-1 transition-colors"
                                            >
                                                Exit
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={() => setIsSearching(true)} className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all" title="Search messages">
                                                <i className="pi pi-search" style={{ fontSize: '13px' }}></i>
                                            </button>
                                            <button
                                                onClick={() => setShowMenu(true)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all"
                                                title="Chat options"
                                            >
                                                <i className="pi pi-ellipsis-v" style={{ fontSize: '14px' }}></i>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 h-full overflow-hidden">
                                <ChatPanel
                                    key={`${selectedParticipant.userId}-${refreshKey}`}
                                    participantId={selectedParticipant.userId}
                                    lastMessage={lastMessageId}
                                    isSearching={isSearching}
                                    setIsSearching={setIsSearching}
                                    searchQ={searchQ}
                                    setSearchQ={setSearchQ}
                                    searchIndex={searchIndex}
                                    setSearchIndex={setSearchIndex}
                                    setSearchCount={setSearchCount}
                                    refreshKey={refreshKey}
                                    onConversationIdFetched={(cid) => {
                                        if (selectedParticipant.conversationId !== cid) {
                                            setSelectedParticipant(prev => ({ ...prev, conversationId: cid }));
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">Select a conversation to start chatting</div>
                    )}
                </div>

                {/* Profile panel - right column (optional) */}
                {profileVisible && (
                    <div className="w-80 border-l border-gray-100 dark:border-gray-800 overflow-y-auto" style={{ width: '30rem' }}>
                        <div className="p-3">
                            <button className="mb-3 text-sm text-gray-500" onClick={() => setProfileVisible(false)}>Close</button>
                            <UserProfile id={selectedUserId} onClose={() => setProfileVisible(false)} maxPosts={9} />
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Options Menu */}
            <Dialog
                header={"Chat Options"}
                visible={showMenu}
                onHide={() => setShowMenu(false)}
                style={{ width: '90vw', maxWidth: '320px', borderRadius: '24px' }}
                className="options-dialog shadow-2xl"
                closable={true}
            >
                <div className="p-2 flex flex-col gap-1">

                    <button
                        onClick={() => {
                            setShowMenu(false);
                            confirmDialog({
                                message: 'Are you sure you want to clear all messages in this chat?',
                                header: 'Clear Chat',
                                icon: 'pi pi-exclamation-triangle',
                                acceptClassName: 'p-button-danger rounded-xl',
                                accept: () => clearChatMut.mutate(selectedParticipant?.conversationId, {
                                    onSuccess: () => setRefreshKey(prev => prev + 1)
                                })
                            });
                        }}
                        disabled={!selectedParticipant?.conversationId}
                        style={{ opacity: selectedParticipant?.conversationId ? 1 : 0.5, cursor: selectedParticipant?.conversationId ? 'pointer' : 'not-allowed' }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-0 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-colors text-red-500 font-medium"
                    >
                        <i className="pi pi-history text-sm"></i>
                        <span className="text-sm">Clear Chat History</span>
                    </button>

                    <button
                        onClick={() => {
                            setShowMenu(false);
                            confirmDialog({
                                message: 'Delete this conversation? This will remove it from your messages completely.',
                                header: 'Delete Chat',
                                icon: 'pi pi-trash',
                                acceptClassName: 'p-button-danger rounded-xl',
                                accept: () => {
                                    const cid = selectedParticipant?.conversationId;
                                    setSelectedParticipant(null);
                                    setShowMenu(false);
                                    deleteChatMut.mutate(cid);
                                }
                            });
                        }}
                        disabled={!selectedParticipant?.conversationId}
                        style={{ opacity: selectedParticipant?.conversationId ? 1 : 0.5, cursor: selectedParticipant?.conversationId ? 'pointer' : 'not-allowed' }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-0 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors text-red-600 font-black"
                    >
                        <i className="pi pi-trash text-sm"></i>
                        <span className="text-sm">Delete Chat</span>
                    </button>
                </div>
            </Dialog>

            {/* New Conversation Dialog */}
            <Dialog
                header={"New Message"}
                visible={isComposeOpen}
                onHide={() => { setIsComposeOpen(false); setGlobalSearch(''); }}
                style={{ width: '95vw', maxWidth: '420px', height: '400px' }}
                className="dark:bg-[var(--surface-1)] "
                closable={true}
            >
                <div className="py-3 flex flex-col gap-4">


                    <div className="relative">
                        <i className={`pi ${isSearchingGlobal ? 'pi-spin pi-spinner' : 'pi-search'} absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm`}></i>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Type a name..."
                            value={globalSearch}
                            onChange={e => setGlobalSearch(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-3xl py-3.5 pl-12 pr-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/20 transition-all"
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto mt-2 flex flex-col gap-1 custom-scrollbar">
                        {globalSearch && searchResults.length === 0 && !isSearchingGlobal && (
                            <div className="text-center py-8 text-gray-400 text-sm italic">No users found for "{globalSearch}"</div>
                        )}

                        {searchResults.filter(u => u._id !== user?._id).map(u => (
                            <div
                                key={u._id}
                                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all duration-200 group"
                                onClick={() => {
                                    openChat({ ...u, userId: u._id, conversationId: null }, null);
                                    setIsComposeOpen(false);
                                    setGlobalSearch('');
                                }}
                            >
                                <img src={u.profilePicture || '/default-profile.png'} className="w-10 h-10 rounded-full object-cover group-hover:scale-105 transition-transform" alt="" />
                                <div className="flex flex-col">
                                    <div className="font-bold text-sm text-[var(--text-main)]">{u.fullname}</div>
                                    <div className="text-xs text-gray-400">@{u.username}</div>
                                </div>
                                <i className="pi pi-chevron-right ml-auto text-gray-300 group-hover:text-[#808bf5] transition-colors" style={{ fontSize: '10px' }}></i>
                            </div>
                        ))}

                        {!globalSearch && (
                            <div className="text-center py-8 text-gray-400 text-xs px-10 leading-relaxed font-medium">Search for people to start a new chat with them.</div>
                        )}
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default Conversations;