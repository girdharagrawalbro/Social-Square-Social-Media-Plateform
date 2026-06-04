import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { socket } from '../../socket';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import toast from 'react-hot-toast';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useConversations, useSearchConversations, useClearChat, useDeleteChat, convoKeys } from '../../hooks/queries/useConversationQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchUsers } from '../../hooks/queries/useExploreQueries';
import { useUserProfile } from '../../hooks/queries/useAuthQueries';
import ChatPanel from './ChatPanel';
// import CallModal from './CallModal';
import formatDate from '../../utils/formatDate';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import { useNavigate, useParams } from 'react-router-dom';
import usePostStore from '../../store/zustand/usePostStore';
import { useMemo } from 'react';
import { uploadToCloudinary } from '../../utils/cloudinary';
import { Image } from 'primereact/image';

const SkeletonConversationItem = () => (
    <div className="flex items-center gap-4 p-3.5 rounded-2xl select-none">
        <div className="skeleton rounded-full w-14 h-14 shrink-0" />
        <div className="flex flex-col justify-center flex-1 min-w-0 gap-2">
            <div className="flex justify-between items-center">
                <div className="skeleton rounded h-4 w-24" />
                <div className="skeleton rounded h-3 w-10" />
            </div>
            <div className="skeleton rounded h-3.5 w-36" />
        </div>
    </div>
);

const Conversations = () => {
    const user = useAuthStore(s => s.user);
    const queryClient = useQueryClient();
    const isOnline = useConversationStore(s => s.isOnline);
    const getLastSeen = useConversationStore(s => s.getLastSeen);
    const incrementUnread = useConversationStore(s => s.incrementUnread);
    const clearUnread = useConversationStore(s => s.clearUnread);
    const unreadCounts = useConversationStore(s => s.unreadCounts);
    // const activeCall = useConversationStore(s => s.activeCall);
    const setActiveCall = useConversationStore(s => s.setActiveCall);

    const [searchQuery, setSearchQuery] = useState('');

    // Infinite Query for conversation list
    const {
        data: infiniteData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
        isLoading
    } = useConversations(user?._id);

    // Deep search query for conversations not in current pages
    const { data: deepSearchResults = [] } = useSearchConversations(user?._id, searchQuery);

    const conversations = useMemo(() => {
        return infiniteData?.pages.flatMap(page => page.conversations) || [];
    }, [infiniteData]);

    const navigate = useNavigate();
    const { userId: routeUserId } = useParams();
    const toId = (v) => (v && typeof v === 'object' && v.toString ? v.toString() : String(v || ''));

    const isGroupRoute = useMemo(() => {
        if (!routeUserId) return false;
        return conversations.some(c => c.isGroup && toId(c._id) === routeUserId);
    }, [conversations, routeUserId]);

    const { data: fetchedProfile } = useUserProfile(isGroupRoute ? null : routeUserId);

    const selectedParticipant = useMemo(() => {
        if (!routeUserId) return null;
        const myId = toId(user?._id);
        const conv = conversations.find(c => {
            if (c.isGroup) {
                return toId(c._id) === routeUserId;
            }
            const other = c.participants?.find(p => toId(p.userId) !== myId);
            return other && toId(other.userId) === routeUserId;
        });
        let base = { userId: routeUserId };
        if (conv) {
            if (conv.isGroup) {
                base = {
                    conversationId: conv._id,
                    isGroup: true,
                    fullname: conv.groupName,
                    profilePicture: conv.groupAvatar || '',
                    participants: conv.participants,
                    groupCreator: conv.groupCreator,
                    groupAdmins: conv.groupAdmins
                };
            } else {
                const other = conv.participants?.find(p => toId(p.userId) !== myId);
                if (other) {
                    base = { ...other, userId: toId(other.userId), conversationId: conv._id };
                }
            }
        } else {
            const active = useConversationStore.getState().activeParticipant;
            if (active && toId(active.conversationId || active.userId) === routeUserId) {
                base = active;
            }
        }
        return {
            ...base,
            fullname: base.fullname || fetchedProfile?.fullname,
            profilePicture: base.profilePicture || base.profile_picture || fetchedProfile?.profilePicture || fetchedProfile?.profile_picture,
        };
    }, [routeUserId, conversations, fetchedProfile, user?._id]);

    // Sync global store with routing-derived participant
    const openChatGlobal = useConversationStore(s => s.openChat);
    const closeChatGlobal = useConversationStore(s => s.closeChat);

    useEffect(() => {
        if (selectedParticipant) {
            openChatGlobal(selectedParticipant.conversationId || null, selectedParticipant);
            if (selectedParticipant.conversationId) {
                clearUnread(selectedParticipant.conversationId);
            }
        } else {
            closeChatGlobal();
        }
    }, [selectedParticipant, openChatGlobal, closeChatGlobal, clearUnread]);

    const [lastMessageId, setLastMessageId] = useState(null);
    const setProfileDetailId = usePostStore(s => s.setProfileDetailId);

    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [globalSearch, setGlobalSearch] = useState('');
    const { data: searchResults = [], isLoading: isSearchingGlobal } = useSearchUsers(globalSearch);

    const [isGroupCreateOpen, setIsGroupCreateOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupAvatar, setGroupAvatar] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [groupSearch, setGroupSearch] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const { data: groupSearchResults = [] } = useSearchUsers(groupSearch);

    const avatarInputRef = useRef(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingAvatar(true);
        try {
            const url = await uploadToCloudinary(file);
            setGroupAvatar(typeof url === 'string' ? url : url?.url);
            toast.success('Avatar uploaded successfully!');
        } catch (err) {
            toast.error('Avatar upload failed');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
    const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
    const [addMembersSearch, setAddMembersSearch] = useState('');
    const [selectedNewMembers, setSelectedNewMembers] = useState([]);
    const { data: addMembersSearchResults = [] } = useSearchUsers(addMembersSearch);
    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [newGroupNameInput, setNewGroupNameInput] = useState('');

    const [isSearching, setIsSearching] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [searchIndex, setSearchIndex] = useState(0);
    const [searchCount, setSearchCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showMenu, setShowMenu] = useState(false);

    const convListRef = useRef(null);
    const convItemRefs = useRef({});
    const [convPill, setConvPill] = useState({ top: 0, height: 76, opacity: 0 });
    const [convPillReady, setConvPillReady] = useState(false);

    useLayoutEffect(() => {
        let observer = null;

        const updatePill = () => {
            const activeEl = convItemRefs.current[routeUserId];
            const nav = convListRef.current;
            if (!activeEl || !nav) {
                setConvPill(s => ({ ...s, opacity: 0 }));
                return;
            }
            const navRect = nav.getBoundingClientRect();
            const elRect = activeEl.getBoundingClientRect();
            setConvPill({
                top: elRect.top - navRect.top + nav.scrollTop,
                height: elRect.height,
                opacity: 1
            });
            setConvPillReady(true);
        };

        updatePill();

        const nav = convListRef.current;
        if (nav) {
            observer = new ResizeObserver(updatePill);
            observer.observe(nav);
        }

        return () => {
            if (observer) observer.disconnect();
        };
    }, [routeUserId, conversations.length]);

    useEffect(() => {
        const nav = convListRef.current;
        if (!nav) return;
        const onScroll = () => {
            const activeEl = convItemRefs.current[routeUserId];
            if (!activeEl) return;
            const navRect = nav.getBoundingClientRect();
            const elRect = activeEl.getBoundingClientRect();
            setConvPill(s => ({
                ...s,
                top: elRect.top - navRect.top + nav.scrollTop,
            }));
        };
        nav.addEventListener('scroll', onScroll);
        return () => nav.removeEventListener('scroll', onScroll);
    }, [routeUserId]);

    const clearChatMut = useClearChat();
    const deleteChatMut = useDeleteChat();

    // Auto-close search when switching chats
    useEffect(() => {
        setIsSearching(false);
        setSearchQ('');
        setSearchIndex(0);
        setSearchCount(0);
    }, [routeUserId]);

    // Memoize the refetch callback to prevent unnecessary effect re-runs
    const handleRefetch = useCallback(() => {
        refetch();
    }, [refetch]);

    // Socket listeners: receive, edit, delete → update UI
    useEffect(() => {
        const handleReceiveMessage = (message) => {
            const { conversationId } = message;

            // Optimistically update query cache for instant feedback
            queryClient.setQueryData(convoKeys.list(toId(user?._id)), (old) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        conversations: page.conversations.map(c => toId(c._id) === toId(conversationId) ? {
                            ...c,
                            lastMessage: {
                                id: message._id,
                                message: message.content || (message.media ? `📎 ${message.media.type || 'file'}` : 'New message'),
                                isRead: false,
                                isReply: !!message.replyTo
                            },
                            lastMessageAt: message.createdAt || new Date().toISOString(),
                            lastMessageBy: message.senderId || message.sender
                        } : c)
                    }))
                };
            });

            // If it's an incoming message, increment unread
            if ((message.senderId || message.sender) !== user?._id) {
                incrementUnread(conversationId);
            }

            handleRefetch();
        };

        const handleMessageEdited = ({ messageId, content, conversationId }) => {
            queryClient.setQueryData(convoKeys.list(toId(user?._id)), (old) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        conversations: page.conversations.map(c => (toId(c._id) === toId(conversationId) && (toId(c.lastMessage?.id) === toId(messageId) || toId(c.lastMessage?._id) === toId(messageId))) ? {
                            ...c,
                            lastMessage: { ...c.lastMessage, message: content || '📎 Media' }
                        } : c)
                    }))
                };
            });
            handleRefetch();
        };

        const handleMessageDeleted = ({ messageId, conversationId }) => {
            queryClient.setQueryData(convoKeys.list(toId(user?._id)), (old) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        conversations: page.conversations.map(c => (toId(c._id) === toId(conversationId) && (toId(c.lastMessage?.id) === toId(messageId) || toId(c.lastMessage?._id) === toId(messageId))) ? {
                            ...c,
                            lastMessage: { ...c.lastMessage, message: '🚫 Message deleted' }
                        } : c)
                    }))
                };
            });
            handleRefetch();
        };

        const handleConversationUpdated = (updatedConv) => {
            queryClient.setQueryData(convoKeys.list(toId(user?._id)), (old) => {
                if (!old || !old.pages) return { pages: [{ conversations: [updatedConv] }], pageParams: [null] };

                let found = false;
                const newPages = old.pages.map(page => {
                    const exists = page.conversations.find(c => toId(c._id) === toId(updatedConv._id));
                    if (exists) {
                        found = true;
                        return { ...page, conversations: page.conversations.map(c => toId(c._id) === toId(updatedConv._id) ? updatedConv : c) };
                    }
                    return page;
                });

                if (!found) {
                    newPages[0].conversations = [updatedConv, ...newPages[0].conversations];
                }
                return { ...old, pages: newPages };
            });
        };

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('messageEdited', handleMessageEdited);
        socket.on('messageDeleted', handleMessageDeleted);
        socket.on('conversationUpdated', handleConversationUpdated);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('messageEdited', handleMessageEdited);
            socket.off('messageDeleted', handleMessageDeleted);
            socket.off('conversationUpdated', handleConversationUpdated);
        };
    }, [handleRefetch, incrementUnread, queryClient, user?._id]);

    const handleStartCall = async (type) => {
        if (!selectedParticipant?.conversationId) {
            toast.error("Please send at least one message to establish a secure chat before calling!");
            return;
        }
        setActiveCall({
            conversationId: selectedParticipant.conversationId,
            recipientId: selectedParticipant.userId,
            recipientName: selectedParticipant.fullname,
            recipientAvatar: selectedParticipant.profilePicture,
            callType: type,
            isIncoming: false
        });
        socket.emit('initiateCall', {
            recipientId: selectedParticipant.userId,
            type,
            conversationId: selectedParticipant.conversationId,
            callerName: user.fullname,
            callerAvatar: user.profile_picture || ''
        });
    };

    const openChat = (participant, lastMsgId) => {
        setLastMessageId(lastMsgId || null);
        openChatGlobal(participant.conversationId || null, participant);
        navigate(`/conversation/${toId(participant.userId)}`);
    };

    const closeChat = () => {
        navigate('/conversations');
    };

    const handleProfileClick = (userId) => {
        if (!userId) return;
        setProfileDetailId(userId);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const diff = Date.now() - new Date(dateString);
        if (diff < 86400000) return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return new Date(dateString).toLocaleDateString();
    };

    // Combine local results and deep search results
    const allConversations = useMemo(() => {
        if (!searchQuery) return conversations;

        // Filter loaded conversations
        const filtered = conversations.filter(conv => {
            const myId = toId(user?._id);
            const other = conv.participants?.find(p => toId(p.userId) !== myId);
            return other?.fullname?.toLowerCase().includes(searchQuery.toLowerCase());
        });

        // Merge with deep search results, avoiding duplicates
        const existingIds = new Set(filtered.map(c => toId(c._id)));
        const uniqueDeep = deepSearchResults.filter(c => !existingIds.has(toId(c._id)));

        return [...filtered, ...uniqueDeep];
    }, [conversations, deepSearchResults, searchQuery, user?._id]);

    const sortedConversations = useMemo(() => {
        return [...allConversations].sort((a, b) => {
            const dateA = new Date(a.lastMessageAt || 0);
            const dateB = new Date(b.lastMessageAt || 0);
            return dateB - dateA;
        });
    }, [allConversations]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 glass-card overflow-hidden transition-all duration-300" style={{ height: '100%' }}>
            <div className="flex flex-1 min-h-0">
                {/* Conversation list - left column */}
                <div className={`w-full sm:w-80 md:w-[30rem] border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden ${selectedParticipant ? 'hidden sm:flex' : 'flex'}`}>
                    <div className="p-3 border-b border-gray-50 dark:border-gray-800 bg-white/50 dark:bg-black/50 backdrop-blur-lg">
                        <div className="flex items-center justify-between max-w-4xl mx-auto mb-3">
                            <h2 className="m-0 text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
                                <i className="pi pi-envelope text-[#808bf5]"></i>
                                Conversations
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsGroupCreateOpen(true)}
                                    className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 text-indigo-500 rounded-full border-0 cursor-pointer hover:bg-indigo-500 hover:text-white transition-all duration-200"
                                    title="Create Group"
                                >
                                    <i className="pi pi-users text-xs font-bold"></i>
                                </button>
                                <button
                                    onClick={() => setIsComposeOpen(true)}
                                    className="w-9 h-9 flex items-center justify-center bg-[#808bf5]/10 text-[#808bf5] rounded-full border-0 cursor-pointer hover:bg-[#808bf5] hover:text-white transition-all duration-200"
                                    title="New Message"
                                >
                                    <i className="pi pi-plus text-xs font-bold"></i>
                                </button>
                            </div>
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
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar relative" ref={convListRef} onScroll={handleScroll}>
                        {/* Floating pill background */}
                        <div
                            style={{
                                position: 'absolute',
                                left: '8px',
                                right: '8px',
                                top: convPill.top,
                                height: convPill.height,
                                borderRadius: '16px',
                                background: 'var(--surface-2)',
                                opacity: convPillReady ? convPill.opacity : 0,
                                transition: convPillReady ? 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s ease, opacity 0.15s ease' : 'none',
                                pointerEvents: 'none',
                                zIndex: 0,
                            }}
                        />
                        {isLoading && sortedConversations.length === 0 ? (
                            <div className="flex flex-col gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <SkeletonConversationItem key={i} />
                                ))}
                            </div>
                        ) : sortedConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 opacity-60">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                    <i className={`pi ${searchQuery ? 'pi-search' : 'pi-envelope'} text-gray-400`}></i>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center m-0 font-medium">
                                    {searchQuery ? 'No results found' : 'No conversations yet'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {sortedConversations.map((conv) => {
                                    const myId = toId(user?._id);
                                    let displayName, displayAvatar, displayId, isOnlineStatus = false;
                                    if (conv.isGroup) {
                                        displayName = conv.groupName;
                                        displayAvatar = conv.groupAvatar || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg';
                                        displayId = toId(conv._id);
                                    } else {
                                        const other = conv.participants?.find(p => toId(p.userId) !== myId);
                                        if (!other) return null;
                                        displayName = other.fullname;
                                        displayAvatar = other.profilePicture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg';
                                        displayId = toId(other.userId);
                                        isOnlineStatus = isOnline(displayId);
                                    }
                                    const convUnread = unreadCounts[conv._id] || 0;
                                    const isUnread = toId(conv.lastMessageBy) !== myId && !conv.lastMessage?.isRead;

                                    const isActive = routeUserId === displayId;
                                    return (
                                        <div key={conv._id}
                                            ref={el => convItemRefs.current[displayId] = el}
                                            className={`flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 relative z-10 ${isActive ? 'ring-1 ring-[#808bf5]/20' : isUnread ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : 'hover:bg-gray-50/80 dark:hover:bg-neutral-900/40'}`}
                                            onClick={() => openChat(conv.isGroup ? { userId: displayId, fullname: displayName, profilePicture: displayAvatar, isGroup: true, conversationId: conv._id } : { ...conv.participants.find(p => toId(p.userId) === displayId), userId: displayId, conversationId: conv._id }, conv.lastMessage?.id)}>
                                            <div className="relative flex-shrink-0">
                                                <img src={displayAvatar} alt={displayName} className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-transparent group-hover:border-[#808bf5]/30 transition-all" />
                                                {!conv.isGroup && isOnlineStatus && (
                                                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm" />
                                                )}
                                                {conv.isGroup && (
                                                    <span className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-indigo-500 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm flex items-center justify-center text-white" style={{ fontSize: '9px' }}>
                                                        <i className="pi pi-users text-[8px]" />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h6 className={`p-0 m-0 text-[15px] truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'}`}>{displayName}</h6>
                                                    <p className="text-gray-400 dark:text-gray-500 p-0 m-0 text-[11px] font-medium flex-shrink-0 ml-2">{formatDateTime(conv.lastMessageAt)}</p>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <p className={`p-0 m-0 text-sm truncate flex-1 leading-tight ${isUnread ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 font-normal'}`}>
                                                        {toId(conv.lastMessageBy) === myId ? <span className="text-[#808bf5] font-bold mr-1">You:</span> : ''}
                                                        {conv.lastMessage?.isReply && <i className="pi pi-reply mr-1 text-[10px] opacity-70"></i>}
                                                        {conv.lastMessage?.message || ''}
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

                                {isFetchingNextPage && (
                                    <div className="flex justify-center p-4">
                                        <i className="pi pi-spin pi-spinner text-indigo-500"></i>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Chat panel - middle column */}
                <div className={`flex-1 flex flex-col min-h-0 h-full ${selectedParticipant ? 'flex' : 'hidden sm:flex'}`}>
                    {selectedParticipant ? (
                        <div className="flex flex-col flex-1 min-h-0 h-full">
                            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between min-h-[64px] bg-white/80 dark:bg-black/80 backdrop-blur-md">
                                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => !selectedParticipant.isGroup && handleProfileClick(selectedParticipant.userId)}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); closeChat(); }}
                                        className="sm:hidden -ml-2 p-2 rounded-full border-0 bg-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center"
                                    >
                                        <i className="pi pi-chevron-left text-lg"></i>
                                    </button>
                                    <div className="relative">
                                        <img src={selectedParticipant.profilePicture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} className="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 group-hover:ring-indigo-200 transition-all font-bold" alt="" />
                                        {!selectedParticipant.isGroup && isOnline(selectedParticipant.userId) && (
                                            <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-950" />
                                        )}
                                        {selectedParticipant.isGroup && (
                                            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-950 flex items-center justify-center text-white" style={{ fontSize: '8px' }}>
                                                <i className="pi pi-users text-[6px]" />
                                            </span>
                                        )}
                                    </div>
                                    <div className={`${isSearching ? 'hidden sm:block' : ''}`}>
                                        <div className="font-black text-sm text-[var(--text-main)] group-hover:text-indigo-500 transition-colors leading-tight">{selectedParticipant.fullname}</div>
                                        {!isSearching && (
                                            <div className="text-[10px] font-medium text-gray-400 mt-0.5">
                                                {selectedParticipant.isGroup
                                                    ? `${selectedParticipant.participants?.length || 0} participants`
                                                    : isOnline(selectedParticipant.userId) ? <span className="text-green-500">Online</span> : `Last seen ${formatDate(getLastSeen(selectedParticipant.userId)) || 'recently'}`
                                                }
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
                                            {!selectedParticipant?.isGroup && (
                                                <>
                                                    <button onClick={() => handleStartCall('voice')} className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all" title="Voice Call">
                                                        <i className="pi pi-phone" style={{ fontSize: '13px' }}></i>
                                                    </button>
                                                    <button onClick={() => handleStartCall('video')} className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all" title="Video Call">
                                                        <i className="pi pi-video" style={{ fontSize: '13px' }}></i>
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => setIsSearching(true)} className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all" title="Search messages">
                                                <i className="pi pi-search" style={{ fontSize: '13px' }}></i>
                                            </button>
                                            <button
                                                onClick={() => selectedParticipant?.isGroup ? setIsGroupSettingsOpen(true) : setShowMenu(true)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-all"
                                                title={selectedParticipant?.isGroup ? "Group Settings" : "Chat options"}
                                            >
                                                <i className={selectedParticipant?.isGroup ? "pi pi-cog" : "pi pi-ellipsis-v"} style={{ fontSize: '14px' }}></i>
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
                                        // conversationId is derived from URL; no local state needed
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">Select a conversation to start chatting</div>
                    )}
                </div>

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
                                }),
                                appendTo: document.body,
                                baseZIndex: 1000000
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
                                    closeChat();
                                    setShowMenu(false);
                                    deleteChatMut.mutate(cid);
                                },
                                appendTo: document.body,
                                baseZIndex: 1000000
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
                                <img src={u.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} className="w-10 h-10 rounded-full object-cover group-hover:scale-105 transition-transform" alt="" />
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

            {/* Create Group Chat Dialog */}
            <Dialog
                header={"Create Group Chat"}
                visible={isGroupCreateOpen}
                onHide={() => { setIsGroupCreateOpen(false); setGroupName(''); setGroupAvatar(''); setSelectedMembers([]); setGroupSearch(''); }}
                style={{ width: '95vw', maxWidth: '440px' }}
                className="dark:bg-[var(--surface-1)]"
                closable={true}
            >
                <div className="py-3 px-3 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Group Name</label>
                        <input
                            type="text"
                            placeholder="Enter group name..."
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl py-3 px-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/20 transition-all font-semibold"
                        />
                    </div>

                    <div className="flex flex-col items-center gap-2 py-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 self-start">Group Avatar</label>
                        <div
                            onClick={() => avatarInputRef.current?.click()}
                            className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:border-[#808bf5] transition-all bg-gray-50 dark:bg-gray-900"
                        >
                            {groupAvatar ? (
                                <img src={groupAvatar} alt="Group Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center text-gray-400 group-hover:text-[#808bf5] transition-colors">
                                    <i className="pi pi-camera text-2xl mb-1"></i>
                                    <span className="text-[10px] font-bold">Upload Photo</span>
                                </div>
                            )}
                            {isUploadingAvatar && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                    <i className="pi pi-spin pi-spinner text-lg"></i>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={avatarInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        {groupAvatar && (
                            <button
                                type="button"
                                onClick={() => setGroupAvatar('')}
                                className="text-xs text-red-500 border-0 bg-transparent cursor-pointer font-bold hover:underline"
                            >
                                Remove Photo
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Add Members</label>
                        <div className="relative">
                            <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                            <input
                                type="text"
                                placeholder="Search people..."
                                value={groupSearch}
                                onChange={e => setGroupSearch(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl py-3 pl-12 pr-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/20 transition-all"
                            />
                        </div>
                    </div>

                    {/* Selected members list (chips) */}
                    {selectedMembers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-2xl max-h-24 overflow-y-auto">
                            {selectedMembers.map(m => (
                                <span key={m._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500 text-white rounded-full text-xs font-semibold">
                                    {m.fullname}
                                    <i className="pi pi-times cursor-pointer text-[10px]" onClick={() => setSelectedMembers(prev => prev.filter(x => x._id !== m._id))}></i>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Member search results */}
                    <div className="max-h-48 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                        {groupSearch && groupSearchResults.filter(u => u._id !== user?._id).map(u => {
                            const isSelected = selectedMembers.some(m => m._id === u._id);
                            return (
                                <div
                                    key={u._id}
                                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all duration-200"
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedMembers(prev => prev.filter(x => x._id !== u._id));
                                        } else {
                                            setSelectedMembers(prev => [...prev, u]);
                                        }
                                    }}
                                >
                                    <img src={u.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} className="w-9 h-9 rounded-full object-cover" alt="" />
                                    <div className="flex flex-col">
                                        <div className="font-bold text-xs text-[var(--text-main)]">{u.fullname}</div>
                                        <div className="text-[10px] text-gray-400">@{u.username}</div>
                                    </div>
                                    <i className={`pi ${isSelected ? 'pi-check-circle text-indigo-500' : 'pi-circle'} ml-auto text-sm transition-colors`}></i>
                                </div>
                            );
                        })}
                        {!groupSearch && (
                            <div className="text-center py-6 text-gray-400 text-xs font-medium">Type a name to search and select members.</div>
                        )}
                    </div>

                    <button
                        onClick={async () => {
                            if (!groupName.trim()) {
                                toast.error('Group name is required');
                                return;
                            }
                            if (selectedMembers.length === 0) {
                                toast.error('At least one member is required');
                                return;
                            }
                            setIsCreatingGroup(true);
                            try {
                                const res = await api.post('/api/conversation/group/create', {
                                    name: groupName.trim(),
                                    groupAvatar: groupAvatar.trim() || undefined,
                                    participantIds: selectedMembers.map(m => m._id)
                                });
                                toast.success('Group created successfully!');
                                setIsGroupCreateOpen(false);
                                setGroupName('');
                                setGroupAvatar('');
                                setSelectedMembers([]);
                                setGroupSearch('');
                                queryClient.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
                                openChat({ userId: res.data._id, fullname: res.data.groupName, profilePicture: res.data.groupAvatar, isGroup: true, conversationId: res.data._id }, null);
                            } catch (err) {
                                toast.error(err.response?.data?.error || 'Failed to create group');
                            } finally {
                                setIsCreatingGroup(false);
                            }
                        }}
                        disabled={isCreatingGroup || !groupName.trim() || selectedMembers.length === 0}
                        className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl py-3 font-bold border-0 cursor-pointer transition-all mt-2 flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-500/20"
                    >
                        {isCreatingGroup ? (
                            <>
                                <i className="pi pi-spin pi-spinner"></i>
                                Creating...
                            </>
                        ) : 'Create Group'}
                    </button>
                </div>
            </Dialog>

            {/* Group Settings & Info Dialog */}
            <Dialog
                header={"Group Settings & Info"}
                visible={isGroupSettingsOpen}
                onHide={() => { setIsGroupSettingsOpen(false); setIsEditingGroupName(false); }}
                style={{ width: '95vw', maxWidth: '460px' }}
                className="dark:bg-[var(--surface-1)] group-settings-dialog"
                closable={true}
            >
                <div className="py-3 px-3 flex flex-col gap-5">
                    {/* Header: Group Avatar & Name */}
                    <div className="flex flex-col items-center gap-3 text-center border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div className="relative group/avatar">
                            <Image
                                src={selectedParticipant?.profilePicture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                zoomSrc={selectedParticipant?.profilePicture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                alt="Profile"
                                className="profile-image-square overflow-hidden shadow-md border-2 border-white dark:border-gray-900"
                                style={{ '--size': '80px' }}
                                preview
                            />

                        </div>

                        {isEditingGroupName ? (
                            <div className="w-full flex items-center justify-center gap-2 px-4">
                                <input
                                    type="text"
                                    value={newGroupNameInput}
                                    onChange={e => setNewGroupNameInput(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-900 border-0 rounded-xl py-1.5 px-3 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/20 font-bold flex-1"
                                />
                                <button
                                    onClick={async () => {
                                        if (!newGroupNameInput.trim()) return;
                                        try {
                                            const res = await api.patch(`/api/conversation/group/${selectedParticipant.conversationId}/update`, {
                                                name: newGroupNameInput.trim()
                                            });
                                            toast.success('Group name updated successfully!');
                                            setIsEditingGroupName(false);
                                            const updatedParticipant = {
                                                ...selectedParticipant,
                                                fullname: res.data.groupName
                                            };
                                            openChatGlobal(selectedParticipant.conversationId, updatedParticipant);
                                            queryClient.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
                                            setRefreshKey(prev => prev + 1);
                                        } catch (err) {
                                            toast.error(err.response?.data?.error || 'Failed to update group name');
                                        }
                                    }}
                                    className="border-0 bg-green-500 hover:bg-green-600 text-white rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setIsEditingGroupName(false)}
                                    className="border-0 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-[var(--text-sub)] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="w-full flex items-center justify-center gap-2 px-4">
                                <h3 className="m-0 font-black text-base text-[var(--text-main)]">{selectedParticipant?.fullname}</h3>
                                {(selectedParticipant?.groupAdmins?.includes(user?._id) || selectedParticipant?.groupCreator === user?._id) && (
                                    <button
                                        onClick={() => {
                                            setNewGroupNameInput(selectedParticipant?.fullname || '');
                                            setIsEditingGroupName(true);
                                        }}
                                        className="border-0 bg-transparent text-gray-400 hover:text-indigo-500 cursor-pointer flex p-1"
                                        title="Edit Group Name"
                                    >
                                        <i className="pi pi-pencil text-xs" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Members List */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Members ({selectedParticipant?.participants?.length || 0})</span>
                            {/* Add Members button if current user is admin */}
                            {(selectedParticipant?.groupAdmins?.includes(user?._id) || selectedParticipant?.groupCreator === user?._id) && (
                                <button
                                    onClick={() => { setIsAddMembersOpen(true); }}
                                    className="flex items-center gap-1 bg-indigo-500/10 border-0 text-indigo-500 cursor-pointer rounded-full px-3 py-1.5 text-xs font-black hover:bg-indigo-500 hover:text-white transition-all"
                                >
                                    <i className="pi pi-user-plus text-[10px]"></i>
                                    Add Member
                                </button>
                            )}
                        </div>

                        <div className="max-h-56 overflow-y-auto flex flex-col gap-2 p-1 custom-scrollbar">
                            {selectedParticipant?.participants?.map(p => {
                                const isAdmin = selectedParticipant.groupAdmins?.includes(p.userId);
                                const isCreator = selectedParticipant.groupCreator === p.userId;
                                const isMe = p.userId === user?._id;

                                return (
                                    <div key={p.userId} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50/50 dark:bg-gray-900/35 border border-gray-100/50 dark:border-gray-800/10 relative">
                                        <img src={p.profilePicture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} className="w-9 h-9 rounded-full object-cover" alt="" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-xs truncate text-[var(--text-main)]">{p.fullname} {isMe && "(You)"}</span>
                                        </div>

                                        <div className="ml-auto flex items-center gap-2">
                                            {isCreator && (
                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-yellow-500/10 text-yellow-600 rounded-full text-[9px] font-bold">
                                                    <i className="pi pi-crown text-[8px]" />
                                                    Creator
                                                </span>
                                            )}
                                            {isAdmin && !isCreator && (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full text-[9px] font-bold">
                                                    Admin
                                                </span>
                                            )}

                                            {/* Remove member option if current user is admin/creator, and target is not the creator, and target is not myself */}
                                            {((selectedParticipant.groupAdmins?.includes(user?._id) || selectedParticipant.groupCreator === user?._id)) && !isCreator && !isMe && (
                                                <button
                                                    onClick={() => {
                                                        confirmDialog({
                                                            message: `Remove ${p.fullname} from the group?`,
                                                            header: 'Remove Member',
                                                            icon: 'pi pi-exclamation-triangle',
                                                            acceptClassName: 'p-button-danger rounded-xl',
                                                            accept: async () => {
                                                                try {
                                                                    const res = await api.post(`/api/conversation/group/${selectedParticipant.conversationId}/remove-members`, {
                                                                        memberIds: [p.userId]
                                                                    });
                                                                    toast.success(`${p.fullname} removed successfully`);
                                                                    // Update selectedParticipant participants list
                                                                    const updatedParticipant = {
                                                                        ...selectedParticipant,
                                                                        participants: res.data.participants,
                                                                        groupAdmins: res.data.groupAdmins
                                                                    };
                                                                    openChatGlobal(selectedParticipant.conversationId, updatedParticipant);
                                                                    queryClient.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
                                                                    setRefreshKey(prev => prev + 1);
                                                                } catch (err) {
                                                                    toast.error(err.response?.data?.error || "Failed to remove member");
                                                                }
                                                            },
                                                            appendTo: document.body,
                                                            baseZIndex: 1000000
                                                        });
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center bg-red-500/10 border-0 text-red-500 rounded-full cursor-pointer hover:bg-red-500 hover:text-white transition-all"
                                                    title="Remove Member"
                                                >
                                                    <i className="pi pi-user-minus text-[10px]" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Danger zone actions */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => {
                                confirmDialog({
                                    message: 'Are you sure you want to leave this group chat?',
                                    header: 'Leave Group',
                                    icon: 'pi pi-exclamation-triangle',
                                    acceptClassName: 'p-button-danger rounded-xl',
                                    accept: async () => {
                                        try {
                                            await api.post(`/api/conversation/group/${selectedParticipant.conversationId}/leave`);
                                            toast.success('Left group successfully');
                                            setIsGroupSettingsOpen(false);
                                            closeChat();
                                            queryClient.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
                                        } catch (err) {
                                            toast.error('Failed to leave group');
                                        }
                                    },
                                    appendTo: document.body,
                                    baseZIndex: 1000000
                                });
                            }}
                            className="w-full flex items-center justify-center gap-2 border-0 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 cursor-pointer rounded-2xl py-3 text-xs font-black transition-all"
                        >
                            <i className="pi pi-sign-out text-xs"></i>
                            Leave Group Chat
                        </button>

                        {/* Delete Group option if current user is Creator */}
                        {(selectedParticipant?.groupCreator === user?._id || selectedParticipant?.groupAdmins?.includes(user?._id)) && (
                            <button
                                onClick={() => {
                                    confirmDialog({
                                        message: 'Delete this group? This will disband the group and remove all chat history for all participants.',
                                        header: 'Delete Group',
                                        icon: 'pi pi-trash',
                                        acceptClassName: 'p-button-danger rounded-xl',
                                        accept: () => {
                                            const cid = selectedParticipant?.conversationId;
                                            closeChat();
                                            setIsGroupSettingsOpen(false);
                                            deleteChatMut.mutate(cid, {
                                                onSuccess: () => toast.success('Group disbanded')
                                            });
                                        },
                                        appendTo: document.body,
                                        baseZIndex: 1000000
                                    });
                                }}
                                className="w-full flex items-center justify-center gap-2 border-0 bg-red-600 hover:bg-red-700 text-white cursor-pointer rounded-2xl py-3 text-xs font-black transition-all shadow-md shadow-red-500/10"
                            >
                                <i className="pi pi-trash text-xs"></i>
                                Disband Group (Delete)
                            </button>
                        )}
                    </div>
                </div>
            </Dialog>

            {/* Add Members picker Dialog */}
            <Dialog
                header={"Add New Members"}
                visible={isAddMembersOpen}
                onHide={() => { setIsAddMembersOpen(false); setAddMembersSearch(''); setSelectedNewMembers([]); }}
                style={{ width: '95vw', maxWidth: '420px' }}
                className="dark:bg-[var(--surface-1)]"
                closable={true}
            >
                <div className="py-3 flex flex-col gap-4">
                    <div className="relative">
                        <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={addMembersSearch}
                            onChange={e => setAddMembersSearch(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl py-3 pl-12 pr-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/20 transition-all"
                        />
                    </div>

                    {selectedNewMembers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-2xl max-h-24 overflow-y-auto">
                            {selectedNewMembers.map(m => (
                                <span key={m._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500 text-white rounded-full text-xs font-semibold">
                                    {m.fullname}
                                    <i className="pi pi-times cursor-pointer text-[10px]" onClick={() => setSelectedNewMembers(prev => prev.filter(x => x._id !== m._id))}></i>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="max-h-48 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                        {addMembersSearch && addMembersSearchResults
                            .filter(u => u._id !== user?._id && !selectedParticipant?.participants?.some(p => p.userId === u._id))
                            .map(u => {
                                const isSelected = selectedNewMembers.some(m => m._id === u._id);
                                return (
                                    <div
                                        key={u._id}
                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all duration-200"
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedNewMembers(prev => prev.filter(x => x._id !== u._id));
                                            } else {
                                                setSelectedNewMembers(prev => [...prev, u]);
                                            }
                                        }}
                                    >
                                        <img src={u.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} className="w-9 h-9 rounded-full object-cover" alt="" />
                                        <div className="flex flex-col">
                                            <div className="font-bold text-xs text-[var(--text-main)]">{u.fullname}</div>
                                            <div className="text-[10px] text-gray-400">@{u.username}</div>
                                        </div>
                                        <i className={`pi ${isSelected ? 'pi-check-circle text-indigo-500' : 'pi-circle'} ml-auto text-sm transition-colors`}></i>
                                    </div>
                                );
                            })}
                        {!addMembersSearch && (
                            <div className="text-center py-6 text-gray-400 text-xs font-medium">Type a name to search and select members to add.</div>
                        )}
                    </div>

                    <button
                        onClick={async () => {
                            if (selectedNewMembers.length === 0) return;
                            try {
                                const res = await api.post(`/api/conversation/group/${selectedParticipant.conversationId}/add-members`, {
                                    memberIds: selectedNewMembers.map(m => m._id)
                                });
                                toast.success('Members added successfully!');
                                // Update selectedParticipant participants list
                                const updatedParticipant = {
                                    ...selectedParticipant,
                                    participants: res.data.participants
                                };
                                openChatGlobal(selectedParticipant.conversationId, updatedParticipant);
                                setIsAddMembersOpen(false);
                                setSelectedNewMembers([]);
                                setAddMembersSearch('');
                                queryClient.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
                                setRefreshKey(prev => prev + 1);
                            } catch (err) {
                                toast.error('Failed to add members');
                            }
                        }}
                        disabled={selectedNewMembers.length === 0}
                        className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl py-3 font-bold border-0 cursor-pointer transition-all mt-2 text-sm shadow-lg shadow-indigo-500/20"
                    >
                        Add Selected Members
                    </button>
                </div>
            </Dialog>
        </div>
    );
};

export default Conversations;
