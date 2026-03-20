import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessagesRead } from '../../hooks/queries/useConversationQueries';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { socket } from '../../socket';
import { uploadToCloudinary, validateImageFile } from '../../utils/cloudinary';
import toast from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// ─── WAVEFORM VOICE NOTE ──────────────────────────────────────────────────────
const VoiceNotePlayer = ({ url, duration }) => {
    const [playing, setPlaying]   = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);
    const animRef  = useRef(null);

    const toggle = () => {
        if (!audioRef.current) return;
        if (playing) { audioRef.current.pause(); cancelAnimationFrame(animRef.current); }
        else { audioRef.current.play(); }
        setPlaying(p => !p);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onEnd  = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
        const onTime = () => {
            setCurrentTime(audio.currentTime);
            setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        };
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('timeupdate', onTime);
        return () => { audio.removeEventListener('ended', onEnd); audio.removeEventListener('timeupdate', onTime); };
    }, []);

    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    // Fake waveform bars (20 bars, varying heights)
    const bars = Array.from({ length: 20 }, (_, i) => {
        const heights = [3, 5, 8, 12, 7, 15, 10, 6, 14, 9, 11, 4, 13, 8, 6, 12, 7, 10, 5, 8];
        return heights[i % heights.length];
    });
    const filledBars = Math.floor((progress / 100) * 20);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', minWidth: '180px' }}>
            <audio ref={audioRef} src={url} preload="metadata" style={{ display: 'none' }} />
            <button onClick={toggle} style={{ width: 28, height: 28, borderRadius: '50%', background: '#808bf5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {playing
                    ? <svg width="10" height="10" viewBox="0 0 10 10" fill="#fff"><rect x="1" y="0" width="3" height="10" /><rect x="6" y="0" width="3" height="10" /></svg>
                    : <svg width="10" height="10" viewBox="0 0 10 10" fill="#fff"><polygon points="2,0 10,5 2,10" /></svg>
                }
            </button>
            {/* Waveform */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                {bars.map((h, i) => (
                    <div key={i} style={{ width: '3px', height: `${h}px`, borderRadius: '2px', background: i < filledBars ? '#808bf5' : 'rgba(128,139,245,0.3)', transition: 'background 0.1s' }} />
                ))}
            </div>
            <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>
                {playing ? fmt(currentTime) : fmt(duration || 0)}
            </span>
        </div>
    );
};

// ─── REACTION PICKER ──────────────────────────────────────────────────────────
const ReactionPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} style={{ position: 'absolute', bottom: '100%', background: '#fff', borderRadius: '24px', padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', gap: '6px', zIndex: 100, border: '1px solid #f3f4f6' }}>
            {EMOJI_REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', borderRadius: '8px', transition: 'transform 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
            ))}
        </div>
    );
};

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwn, conversationId, loggeduser }) => {
    const [showReactions, setShowReactions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [editing, setEditing]   = useState(false);
    const [editText, setEditText] = useState(message.content);
    const reactMutation  = useReactToMessage();
    const editMutation   = useEditMessage();
    const deleteMutation = useDeleteMessage();

    const isDeleted = !!message.deletedAt;
    const reactions = message.reactions ? Object.entries(message.reactions) : [];

    // Group reactions by emoji
    const reactionGroups = reactions.reduce((acc, [uid, emoji]) => {
        acc[emoji] = (acc[emoji] || []);
        acc[emoji].push(uid);
        return acc;
    }, {});

    const handleReact = (emoji) => {
        reactMutation.mutate({ messageId: message._id, emoji, conversationId, userId: loggeduser._id });
    };
    const handleEdit = () => {
        editMutation.mutate({ messageId: message._id, content: editText, conversationId });
        setEditing(false);
    };
    const handleDelete = () => {
        if (!window.confirm('Delete this message?')) return;
        deleteMutation.mutate({ messageId: message._id, conversationId });
    };

    return (
        <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '4px', position: 'relative' }}
            onMouseEnter={() => !isDeleted && setShowMenu(true)}
            onMouseLeave={() => { setShowMenu(false); setShowReactions(false); }}>

            {/* Reaction picker trigger */}
            {showMenu && !isDeleted && (
                <div style={{ position: 'relative', alignSelf: 'center', margin: isOwn ? '0 4px 0 0' : '0 0 0 4px', order: isOwn ? -1 : 1 }}>
                    <button onClick={() => setShowReactions(v => !v)}
                        style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>😊</button>
                    {showReactions && <ReactionPicker onSelect={handleReact} onClose={() => setShowReactions(false)} />}
                </div>
            )}

            {/* Bubble */}
            <div style={{ maxWidth: '70%', position: 'relative' }}>
                {editing ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                            style={{ padding: '8px 12px', borderRadius: '16px', border: '1px solid #808bf5', fontSize: '14px', outline: 'none', minWidth: '150px' }} />
                        <button onClick={handleEdit} style={{ background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                        <button onClick={() => setEditing(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                    </div>
                ) : (
                    <div style={{ background: isOwn ? '#808bf5' : '#f3f4f6', color: isOwn ? '#fff' : '#1f2937', borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: isDeleted ? '8px 14px' : '10px 14px', fontSize: '14px', lineHeight: 1.5 }}>
                        {isDeleted ? (
                            <span style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '12px' }}>🚫 Message deleted</span>
                        ) : (
                            <>
                                {/* Media */}
                                {message.media?.url && (
                                    <div style={{ marginBottom: message.content ? '8px' : 0 }}>
                                        {message.media.type === 'image' && (
                                            <img src={message.media.url} alt="" style={{ maxWidth: '200px', borderRadius: '12px', display: 'block' }} />
                                        )}
                                        {message.media.type === 'audio' && (
                                            <VoiceNotePlayer url={message.media.url} duration={message.media.size} />
                                        )}
                                        {message.media.type === 'video' && (
                                            <video src={message.media.url} controls style={{ maxWidth: '200px', borderRadius: '12px' }} />
                                        )}
                                        {message.media.type === 'file' && (
                                            <a href={message.media.url} target="_blank" rel="noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOwn ? '#fff' : '#808bf5', textDecoration: 'none', fontSize: '13px' }}>
                                                📎 {message.media.name || 'File'}
                                            </a>
                                        )}
                                    </div>
                                )}
                                {message.content && <p style={{ margin: 0 }}>{message.content}</p>}
                                {message.edited && <span style={{ fontSize: '10px', opacity: 0.6 }}> (edited)</span>}
                            </>
                        )}
                    </div>
                )}

                {/* Timestamp + read receipt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isOwn && !isDeleted && (
                        message.isRead
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808bf5" strokeWidth="2"><path d="M3 13s1.5.7 3.5 4c0 0 .28-.48.82-1.25M17 6c-2.29 1.15-4.69 3.56-6.61 5.82" /><path d="M8 13s1.5.7 3.5 4c0 0 5.5-8.5 10.5-11" /></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M5 14.5s1.5 0 3.5 3.5c0 0 5.5-9.5 10.5-11" /></svg>
                    )}
                </div>

                {/* Reactions display */}
                {Object.keys(reactionGroups).length > 0 && !isDeleted && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                        {Object.entries(reactionGroups).map(([emoji, users]) => (
                            <button key={emoji} onClick={() => handleReact(emoji)}
                                style={{ background: users.includes(loggeduser._id) ? '#ede9fe' : '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '2px 6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {emoji} {users.length > 1 && <span style={{ fontSize: '10px', color: '#6b7280' }}>{users.length}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Edit/delete menu */}
                {showMenu && isOwn && !isDeleted && (
                    <div style={{ position: 'absolute', right: 0, top: '-30px', display: 'flex', gap: '4px', background: '#fff', borderRadius: '10px', padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #f3f4f6', zIndex: 10 }}>
                        <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', padding: '2px 4px' }}>✏️</button>
                        <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 4px' }}>🗑️</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
const ChatPanel = ({ participantId, lastMessage }) => {
    const user         = useAuthStore(s => s.user);
    const store        = useConversationStore();
    const chatRef      = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimer  = useRef(null);

    const [text, setText]       = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [uploading, setUploading] = useState(false);

    const participantIds = user?._id && participantId ? [user._id, participantId] : null;
    const { data, isLoading } = useMessages(participantIds);
    const sendMutation  = useSendMessage();
    const markRead      = useMarkMessagesRead();

    const conversationId = data?.conversation?._id;

    // Merge server messages + socket messages
    const serverMessages = data?.messages || [];
    const socketMessages = conversationId ? store.getSocketMessages(conversationId) : [];
    const allMessages = [...serverMessages, ...socketMessages.filter(sm => !serverMessages.some(m => m._id === sm._id))].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Socket listeners
    useEffect(() => {
        socket.on('receiveMessage', (message) => {
            if (message.senderId === participantId && conversationId) {
                store.addSocketMessage(conversationId, message);
                markRead.mutate({ unreadMessageIds: [message._id], lastMessage: message._id, conversationId });
                socket.emit('readMessage', { messageId: message._id, socketId: message.socketId });
            }
        });
        socket.on('seenMessage', ({ messageId }) => {
            if (conversationId) store.updateMessageStatus(conversationId, messageId, { isRead: true });
        });
        socket.on('messageEdited', ({ messageId, content, conversationId: cid }) => {
            if (cid === conversationId) store.updateMessageStatus(cid, messageId, { content, edited: true });
        });
        socket.on('messageDeleted', ({ messageId, conversationId: cid }) => {
            if (cid === conversationId) store.updateMessageStatus(cid, messageId, { deletedAt: new Date().toISOString() });
        });
        socket.on('messageReaction', ({ messageId, conversationId: cid, reactions }) => {
            if (cid === conversationId) store.updateMessageStatus(cid, messageId, { reactions });
        });
        socket.on('userTyping',       ({ senderName }) => { if (conversationId) store.setTyping(conversationId, senderName); });
        socket.on('userStoppedTyping',() => { if (conversationId) store.clearTyping(conversationId); });

        return () => {
            socket.off('receiveMessage'); socket.off('seenMessage');
            socket.off('messageEdited'); socket.off('messageDeleted');
            socket.off('messageReaction'); socket.off('userTyping'); socket.off('userStoppedTyping');
        };
    }, [participantId, conversationId]);

    // Mark unread on load
    useEffect(() => {
        if (!allMessages.length || !conversationId) return;
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
        const unread = allMessages.filter(m => !m.isRead && m.sender?.toString() === participantId).map(m => m._id);
        if (unread.length) markRead.mutate({ unreadMessageIds: unread, lastMessage, conversationId });
    }, [allMessages.length, conversationId]);

    const handleInputChange = (e) => {
        setText(e.target.value);
        socket.emit('typing', { recipientId: participantId, senderName: user.fullname });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => socket.emit('stopTyping', { recipientId: participantId }), 1500);
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim() || !conversationId) return;
        socket.emit('stopTyping', { recipientId: participantId });
        sendMutation.mutate({ conversationId, content: text.trim(), recipientId: participantId });
        setText('');
    };

    // Media upload
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;
        setUploading(true);
        try {
            let mediaUrl, mediaType;
            if (file.type.startsWith('image/')) {
                mediaUrl  = await uploadToCloudinary(file);
                mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
                const fd = new FormData();
                fd.append('file', file); fd.append('upload_preset', 'socialsquare'); fd.append('resource_type', 'video');
                const res = await fetch(`https://api.cloudinary.com/v1_1/dcmrsdydr/video/upload`, { method: 'POST', body: fd });
                mediaUrl  = (await res.json()).secure_url;
                mediaType = 'video';
            } else {
                // Generic file
                mediaUrl  = await uploadToCloudinary(file);
                mediaType = 'file';
            }
            sendMutation.mutate({ conversationId, content: '', recipientId: participantId, mediaUrl, mediaType, mediaName: file.name, mediaSize: file.size });
        } catch { toast.error('Upload failed'); }
        setUploading(false);
        e.target.value = '';
    };

    const isTypingOther = conversationId && store.isTyping(conversationId);
    const typingName    = conversationId ? store.getTypingName(conversationId) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '77vh' }}>

            {/* Search bar */}
            {showSearch && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Search messages..." value={searchQ} onChange={e => setSearchQ(e.target.value)} autoFocus
                        style={{ flex: 1, padding: '6px 12px', borderRadius: '20px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
                    <button onClick={() => { setShowSearch(false); setSearchQ(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
                </div>
            )}

            {/* Messages */}
            <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading...</div>
                ) : allMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '13px' }}>No messages yet. Say hi! 👋</div>
                ) : (
                    allMessages
                        .filter(m => !searchQ || m.content?.toLowerCase().includes(searchQ.toLowerCase()))
                        .map(message => (
                            <MessageBubble key={message._id} message={message}
                                isOwn={message.sender?.toString() === user?._id?.toString() || message.senderId === user?._id}
                                conversationId={conversationId}
                                loggeduser={user}
                            />
                        ))
                )}

                {/* Typing indicator */}
                {isTypingOther && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <div style={{ background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: '4px' }}>{typingName}</span>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', animation: `typingDot 1s ${i * 0.2}s infinite` }} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Input bar */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 12px' }}>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Search toggle */}
                    <button type="button" onClick={() => setShowSearch(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: showSearch ? '#808bf5' : '#9ca3af', fontSize: '16px', padding: '4px', flexShrink: 0 }}>🔍</button>

                    {/* Media attach */}
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

            <style>{`
                @keyframes typingDot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
            `}</style>
        </div>
    );
};

export default ChatPanel;