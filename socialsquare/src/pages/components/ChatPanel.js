import  { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { socket } from '../../socket';
import { uploadToCloudinary, uploadVideoToCloudinary } from '../../utils/cloudinary';
import toast from 'react-hot-toast';
import { useSendMessage, useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessagesRead } from '../../hooks/queries/useConversationQueries';
import PostDetail from './PostDetail';
import { Dialog } from 'primereact/dialog';

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// ─── WAVEFORM PLAYER ──────────────────────────────────────────────────────────
const VoiceNotePlayer = ({ url, duration }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);
    const bars = [3, 5, 8, 12, 7, 15, 10, 6, 14, 9, 11, 4, 13, 8, 6, 12, 7, 10, 5, 8];
    const filledBars = Math.floor((progress / 100) * 20);
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    const toggle = () => {
        if (!audioRef.current) return;
        if (playing) audioRef.current.pause();
        else audioRef.current.play();
        setPlaying(p => !p);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
        const onTime = () => { setCurrentTime(audio.currentTime); setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0); };
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('timeupdate', onTime);
        return () => { audio.removeEventListener('ended', onEnd); audio.removeEventListener('timeupdate', onTime); };
    }, []);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', minWidth: '180px' }}>
            <audio ref={audioRef} src={url} preload="metadata" style={{ display: 'none' }} />
            <button onClick={toggle} style={{ width: 28, height: 28, borderRadius: '50%', background: '#808bf5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {playing
                    ? <svg width="10" height="10" fill="#fff"><rect x="1" y="0" width="3" height="10" /><rect x="6" y="0" width="3" height="10" /></svg>
                    : <svg width="10" height="10" fill="#fff"><polygon points="2,0 10,5 2,10" /></svg>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                {bars.map((h, i) => <div key={i} style={{ width: '3px', height: `${h}px`, borderRadius: '2px', background: i < filledBars ? '#808bf5' : 'rgba(128,139,245,0.3)' }} />)}
            </div>
            <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>{playing ? fmt(currentTime) : fmt(duration || 0)}</span>
        </div>
    );
};

// ─── REACTION PICKER ──────────────────────────────────────────────────────────
const ReactionPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} style={{ position: 'absolute', top: '100%', marginTop: '0px', left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: '24px', padding: '8px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.2)', display: 'flex', gap: '2px', zIndex: 9999, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
            {EMOJI_REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '4px', borderRadius: '8px', transition: 'transform 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
            ))}
        </div>
    );
};

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwn, conversationId, loggeduser, onReact, onEdit, onDelete }) => {
    const [showReactions, setShowReactions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const [showPostModal, setShowPostModal] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);

    const isDeleted = !!message.deletedAt;

    // Extract post ID from shared post URL
    const extractPostId = (text) => {
        const match = text.match(/\/post\/([a-f0-9]+)/);
        return match ? match[1] : null;
    };

    const isSharedPost = message.content && message.content.includes('/post/') && message.content.includes('Shared a post');
    const sharedPostId = isSharedPost ? extractPostId(message.content) : null;
    const reactions = message.reactions ? Object.entries(message.reactions) : [];
    const reactionGroups = reactions.reduce((acc, [uid, emoji]) => {
        if (!acc[emoji]) acc[emoji] = [];
        acc[emoji].push(uid);
        return acc;
    }, {});

    const handleEditSave = () => { onEdit(message._id, editText); setEditing(false); };

    return (
        <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '4px', position: 'relative' }}
            onMouseEnter={() => !isDeleted && setShowMenu(true)}
            onMouseLeave={() => { setShowMenu(false); setShowReactions(false); }}>

            {showMenu && !isDeleted && (
                <div style={{ position: 'relative', alignSelf: 'center', margin: isOwn ? '0 4px 0 0' : '0 0 0 4px', order: isOwn ? -1 : 1 }}>
                    <button onClick={() => setShowReactions(v => !v)} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} title="Add reaction">😊</button>
                    {showReactions && <ReactionPicker onSelect={emoji => onReact(message._id, emoji)} onClose={() => setShowReactions(false)} />}
                </div>
            )}

            <div style={{
                maxWidth: '80%',
                wordBreak: 'break-word', position: 'relative'
            }}>
                {editing ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                            style={{ padding: '8px 12px', borderRadius: '16px', border: '1px solid #808bf5', fontSize: '14px', outline: 'none', minWidth: '150px' }} />
                        <button onClick={handleEditSave} style={{ background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                        <button onClick={() => setEditing(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                    </div>
                ) : (
                    <div style={{ background: isOwn ? '#808bf5' : '#f3f4f6', color: isOwn ? '#fff' : '#1f2937', borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', fontSize: '14px', lineHeight: 1.5 }}>
                        {isDeleted ? <span style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '12px' }}>🚫 Message deleted</span> : (
                            <>
                                {isSharedPost ? (
                                    <div onClick={() => { setSelectedPostId(sharedPostId); setShowPostModal(true); }} style={{ cursor: 'pointer', padding: '12px', background: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)', borderRadius: '12px', marginBottom: '8px', border: isOwn ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.1)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '20px' }}>📤</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 500, opacity: 0.9 }}>Shared a post</p>
                                            <p style={{ margin: 0, fontSize: '11px', opacity: 0.7, wordBreak: 'break-all' }}>Tap to view post details →</p>
                                        </div>
                                    </div>
                                ) : null}
                                {message.media?.url && (
                                    <div style={{ marginBottom: message.content ? '8px' : 0 }}>
                                        {message.media.type === 'image' && <img src={message.media.url} alt="" style={{
                                            maxWidth: '100%',
                                            maxHeight: '250px', borderRadius: '12px', display: 'block'
                                        }} />}
                                        {message.media.type === 'audio' && <VoiceNotePlayer url={message.media.url} duration={message.media.size} />}
                                        {message.media.type === 'video' && <video src={message.media.url} controls style={{ maxWidth: '200px', borderRadius: '12px' }} />}
                                        {message.media.type === 'file' && <a href={message.media.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOwn ? '#fff' : '#808bf5', textDecoration: 'none', fontSize: '13px' }}>📎 {message.media.name || 'File'}</a>}
                                    </div>
                                )}
                                {!isSharedPost && message.content && <p style={{ margin: 0 }}>{message.content}</p>}
                                {message.edited && <span style={{ fontSize: '10px', opacity: 0.6 }}> (edited)</span>}
                            </>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {isOwn && !isDeleted && (
                        message.isRead
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808bf5" strokeWidth="2"><path d="M3 13s1.5.7 3.5 4c0 0 .28-.48.82-1.25M17 6c-2.29 1.15-4.69 3.56-6.61 5.82" /><path d="M8 13s1.5.7 3.5 4c0 0 5.5-8.5 10.5-11" /></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M5 14.5s1.5 0 3.5 3.5c0 0 5.5-9.5 10.5-11" /></svg>
                    )}
                </div>

                {Object.keys(reactionGroups).length > 0 && !isDeleted && (
                    <div style={{ position: 'absolute', left: isOwn ? 'auto' : '100%', right: isOwn ? '100%' : 'auto', marginLeft: isOwn ? 0 : '4px', marginRight: isOwn ? '4px' : 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
                        {Object.entries(reactionGroups).map(([emoji, users]) => (
                            <button key={emoji} onClick={() => onReact(message._id, emoji)}
                                style={{ background: users.includes(loggeduser._id) ? '#c4b5fd' : '#f3f4f6', border: users.includes(loggeduser._id) ? '1px solid #a78bfa' : '1px solid #e5e7eb', borderRadius: '14px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500, transition: 'all 0.2s', boxShadow: users.includes(loggeduser._id) ? '0 1px 3px rgba(168,85,247,0.2)' : 'none' }}>
                                {emoji} {users.length > 1 && <span style={{ fontSize: '10px', color: '#4b5563', fontWeight: 600 }}>{users.length}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {showMenu && isOwn && !isDeleted && (
                    <div style={{ position: 'absolute', right: 0, top: '-30px', display: 'flex', gap: '4px', background: '#fff', borderRadius: '10px', padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #f3f4f6', zIndex: 10 }}>
                        <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', padding: '2px 4px' }}>✏️</button>
                        <button onClick={() => onDelete(message._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 4px' }}>🗑️</button>
                    </div>
                )}

                {showPostModal && selectedPostId && (
                    <Dialog header="Post Detail" visible={showPostModal} style={{ width: '95vw', maxWidth: '1000px', height: '80vh' }} onHide={() => setShowPostModal(false)} modal className="p-0">
                        <PostDetail postId={selectedPostId} isModal={true} onClose={() => setShowPostModal(false)} />
                    </Dialog>
                )}
            </div>  
        </div>  
    );
};

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
const ChatPanel = ({ participantId, lastMessage }) => {
    const user = useAuthStore(s => s.user);
    const store = useConversationStore();
    const chatRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimer = useRef(null);
    const conversationIdRef = useRef(null);

    const [text, setText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);

    // ✅ TanStack Query mutations
    const sendMessageMut = useSendMessage();
    const editMessageMut = useEditMessage();
    const deleteMessageMut = useDeleteMessage();
    const reactToMessageMut = useReactToMessage();
    const markReadMut = useMarkMessagesRead();

    // ✅ Fetch messages from backend directly (no TanStack Query confusion)
    const fetchMessages = useCallback(async () => {
        if (!user?._id || !participantId) return;
        setLoading(true);
        try {
            const res = await api.post(`/api/conversation/messages`, {
                recipientId: participantId
            });
            const fetchedMessages = res.data.messages || [];
            const fetchedConversationId = res.data.conversation?._id || null;

            setMessages(fetchedMessages);
            setConversationId(fetchedConversationId);
            conversationIdRef.current = fetchedConversationId;

            // When opening chat, mark any existing incoming unread messages as read.
            const unreadIncomingIds = fetchedMessages
                .filter(m => (m.sender?.toString?.() || m.senderId) !== user?._id && !m.isRead)
                .map(m => m._id);

            if (fetchedConversationId && unreadIncomingIds.length) {
                markReadMut.mutate({
                    unreadMessageIds: unreadIncomingIds,
                    lastMessage: unreadIncomingIds[unreadIncomingIds.length - 1],
                    conversationId: fetchedConversationId,
                });

                setMessages(prev => prev.map(m =>
                    unreadIncomingIds.includes(m._id) ? { ...m, isRead: true } : m
                ));
            }
        } catch (err) {
            console.error('Failed to fetch messages', err);
        }
        setLoading(false);
    }, [user?._id, participantId]); // ✅ FIXED: removed markReadMut from dependency array to prevent infinite loops

    useEffect(() => { fetchMessages(); }, [fetchMessages]);

    // ✅ Scroll to bottom whenever messages change
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages]);

    // ✅ Socket listeners with stable ref — no stale closure issues
    useEffect(() => {
        const handleReceive = (message) => {
            // Only handle messages from current participant
            if (message.senderId !== participantId && message.sender !== participantId) return;

            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m._id === message._id)) return prev;
                return [...prev, message];
            });

            // Mark as read
            if (conversationIdRef.current) {
                markReadMut.mutate({
                    unreadMessageIds: [message._id],
                    lastMessage: message._id,
                    conversationId: conversationIdRef.current,
                });
                socket.emit('readMessage', { messageId: message._id, socketId: message.socketId });
            }
        };

        const handleSeen = ({ messageId }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isRead: true } : m));
        };

        const handleEdited = ({ messageId, content, conversationId: cid }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content, edited: true } : m));
        };

        const handleDeleted = ({ messageId }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m));
        };

        const handleReaction = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
        };

        const handleTyping = ({ senderName }) => {
            if (conversationIdRef.current) store.setTyping(conversationIdRef.current, senderName);
        };

        const handleStopTyping = () => {
            if (conversationIdRef.current) store.clearTyping(conversationIdRef.current);
        };

        socket.on('receiveMessage', handleReceive);
        socket.on('seenMessage', handleSeen);
        socket.on('messageEdited', handleEdited);
        socket.on('messageDeleted', handleDeleted);
        socket.on('messageReaction', handleReaction);
        socket.on('userTyping', handleTyping);
        socket.on('userStoppedTyping', handleStopTyping);

        return () => {
            socket.off('receiveMessage', handleReceive);
            socket.off('seenMessage', handleSeen);
            socket.off('messageEdited', handleEdited);
            socket.off('messageDeleted', handleDeleted);
            socket.off('messageReaction', handleReaction);
            socket.off('userTyping', handleTyping);
            socket.off('userStoppedTyping', handleStopTyping);
        };
    }, [participantId, markReadMut, store]); // ✅ only re-run when participantId changes

    // ─── SEND ────────────────────────────────────────────────────────────────
    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || !conversationId) return;

        const optimisticMsg = {
            _id: `temp_${Date.now()}`,
            sender: user._id,
            content: text.trim(),
            conversationId,
            createdAt: new Date().toISOString(),
            isRead: false,
            isOptimistic: true,
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setText('');
        socket.emit('stopTyping', { recipientId: participantId });

        try {
            const res = await sendMessageMut.mutateAsync({
                conversationId,
                content: optimisticMsg.content,
                recipientId: participantId,
            });

            setMessages(prev => prev.map(m =>
                m._id === optimisticMsg._id ? res.data : m
            ));

            socket.emit('sendMessage', {
                ...res.data,
                recipientId: participantId,
                senderName: user.fullname,
                sender: user._id,
                senderId: user._id,
                socketId: socket.id,
            });

        } catch {
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
            toast.error('Failed to send message');
        }
    };

    // ─── TYPING ───────────────────────────────────────────────────────────────
    const handleInputChange = (e) => {
        setText(e.target.value);
        socket.emit('typing', { recipientId: participantId, senderName: user.fullname });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => socket.emit('stopTyping', { recipientId: participantId }), 1500);
    };

    // ─── REACT ────────────────────────────────────────────────────────────────
    const handleReact = async (messageId, emoji) => {
        try {
            const res = await reactToMessageMut.mutateAsync({
                messageId,
                emoji,
                conversationId: conversationIdRef.current,
            });
            const reactions = res.data.reactions;
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
            socket.emit('messageReaction', {
                messageId,
                conversationId: conversationIdRef.current,
                reactions,
                recipientId: participantId,
            });
        } catch { toast.error('Reaction failed'); }
    };

    // ─── EDIT ─────────────────────────────────────────────────────────────────
    const handleEdit = async (messageId, content) => {
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content, edited: true } : m));
        try {
            await editMessageMut.mutateAsync({
                messageId,
                content,
                conversationId: conversationIdRef.current,
            });
            socket.emit('messageEdited', {
                messageId,
                content,
                conversationId: conversationIdRef.current,
                recipientId: participantId,
            });
        } catch {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content: m.content, edited: m.edited } : m));
            toast.error('Edit failed');
        }
    };

    // ─── DELETE ───────────────────────────────────────────────────────────────
    const handleDelete = async (messageId) => {
        if (!window.confirm('Delete this message?')) return;
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
        try {
            await deleteMessageMut.mutateAsync({
                messageId,
                conversationId: conversationIdRef.current,
            });
            socket.emit('messageDeleted', {
                messageId,
                conversationId: conversationIdRef.current,
                recipientId: participantId,
            });
        } catch {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedAt: null, content: m.content } : m));
            toast.error('Delete failed');
        }
    };

    // ─── MEDIA UPLOAD ─────────────────────────────────────────────────────────
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;
        setUploading(true);
        try {
            let mediaUrl, mediaType;
            if (file.type.startsWith('image/')) {
                mediaUrl = await uploadToCloudinary(file); mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
                mediaUrl = await uploadVideoToCloudinary(file); mediaType = 'video';
            } else {
                mediaUrl = await uploadToCloudinary(file); mediaType = 'file';
            }

            const res = await sendMessageMut.mutateAsync({
                conversationId,
                content: '',
                recipientId: participantId,
                mediaUrl,
                mediaType,
                mediaName: file.name,
                mediaSize: file.size,
            });
            setMessages(prev => [...prev, res.data]);
            socket.emit('sendMessage', { ...res.data, recipientId: participantId, senderName: user.fullname, sender: user._id, senderId: user._id, socketId: socket.id });
        } catch { toast.error('Upload failed'); }
        setUploading(false);
        e.target.value = '';
    };

    const isTypingOther = conversationId && store.isTyping(conversationId);
    const typingName = conversationId ? store.getTypingName(conversationId) : null;

    const displayMessages = messages.filter(m =>
        !searchQ || m.content?.toLowerCase().includes(searchQ.toLowerCase())
    );

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative'
        }}>

            {showSearch && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Search messages..." value={searchQ} onChange={e => setSearchQ(e.target.value)} autoFocus
                        style={{ flex: 1, padding: '6px 12px', borderRadius: '20px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
                    <button onClick={() => { setShowSearch(false); setSearchQ(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
                </div>
            )}

            {/* Messages */}
            <div ref={chatRef} style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                paddingBottom: '80px', // ✅ space for input
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading...</div>
                ) : displayMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '13px' }}>No messages yet. Say hi! 👋</div>
                ) : displayMessages.map(message => (
                    <MessageBubble key={message._id} message={message}
                        isOwn={message.sender?.toString() === user?._id?.toString() || message.senderId === user?._id}
                        conversationId={conversationId}
                        loggeduser={user}
                        onReact={handleReact}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ))}

                {isTypingOther && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <div style={{ background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: '4px' }}>{typingName}</span>
                            {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', animation: `typingDot 1s ${i * 0.2}s infinite` }} />)}
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div style={{
                padding: '10px 12px',
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                background: '#fff',
                zIndex: 10
            }}>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" onClick={() => setShowSearch(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: showSearch ? '#808bf5' : '#9ca3af', fontSize: '16px', padding: '4px', flexShrink: 0 }}>🔍</button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', padding: '4px', flexShrink: 0 }}>
                        {uploading ? '⏳' : '📎'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleFileSelect} style={{ display: 'none' }} />
                    <input type="text" value={text} onChange={handleInputChange} placeholder="Type your message..."
                        style={{ flex: 1, padding: '10px 16px', borderRadius: '24px', border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none', background: '#f9fafb' }}
                        onFocus={e => e.target.style.borderColor = '#808bf5'}
                        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                    <button type="submit" disabled={!text.trim() && !uploading}
                        style={{ width: 40, height: 40, borderRadius: '50%', background: text.trim() ? '#808bf5' : '#e5e7eb', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
                        <i className="pi pi-send" style={{ fontSize: '16px', color: text.trim() ? '#fff' : '#9ca3af' }}></i>
                    </button>
                </form>
            </div>

            <style>{`@keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }`}</style>
        </div>
    );
};

export default ChatPanel;