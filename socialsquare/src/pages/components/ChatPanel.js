import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { socket } from '../../socket';
import { uploadToCloudinary, uploadVideoToCloudinary } from '../../utils/cloudinary';
import toast from 'react-hot-toast';
import { useSendMessage, useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessagesRead } from '../../hooks/queries/useConversationQueries';
import PostDetail from './PostDetail';
import UserProfile from './UserProfile';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import ProgressiveImage from './ui/ProgressiveImage';
import useWindowWidth from '../../hooks/useWindowWidth';

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
            <button type="button" onClick={toggle} aria-pressed={playing} aria-label={playing ? 'Pause voice note' : 'Play voice note'} style={{ width: 28, height: 28, borderRadius: '50%', background: '#808bf5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
    const [focusIndex, setFocusIndex] = useState(0);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);

    useEffect(() => {
        // focus the first emoji when opened
        const btn = ref.current?.querySelectorAll('button')[focusIndex];
        if (btn) btn.focus();
    }, [focusIndex]);

    const onKeyDown = (e) => {
        const total = EMOJI_REACTIONS.length;
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setFocusIndex(i => (i + 1) % total);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setFocusIndex(i => (i - 1 + total) % total);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const emoji = EMOJI_REACTIONS[focusIndex];
            if (emoji) { onSelect(emoji); onClose(); }
        }
    };

    return (
        <div ref={ref} tabIndex={0} onKeyDown={onKeyDown} role="menu" aria-label="Emoji reactions" style={{ position: 'absolute', top: '100%', marginTop: '0px', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-1)', borderRadius: '24px', padding: '8px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.2)', display: 'flex', gap: '2px', zIndex: 9999, border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
            {EMOJI_REACTIONS.map((emoji, idx) => (
                <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    aria-label={`React ${emoji}`}
                    onClick={() => { onSelect(emoji); onClose(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '4px', borderRadius: '8px', transition: 'transform 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; setFocusIndex(idx); }}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >{emoji}</button>
            ))}
        </div>
    );
};

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwn, conversationId, loggeduser, onReact, onEdit, onDelete, searchQ, isSelected, onSelect }) => {
    const [showReactions, setShowReactions] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const [showPostModal, setShowPostModal] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [storyModalOpen, setStoryModalOpen] = useState(false);
    const [storyModalGroups, setStoryModalGroups] = useState([]);
    const [storyModalGroupIndex, setStoryModalGroupIndex] = useState(0);
    const [storyModalInitialStoryId, setStoryModalInitialStoryId] = useState(null);
    const [StoryViewerComp, setStoryViewerComp] = useState(null);
    const [ShareStoryDialogComp, setShareStoryDialogComp] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [sharingStory, setSharingStory] = useState(null);
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;


    const isDeleted = !!message.deletedAt;
    const longPressTimer = useRef(null);

    const handleTouchStart = () => {
        if (isDeleted) return;
        longPressTimer.current = setTimeout(() => {
            onSelect();
            if (window.navigator?.vibrate) window.navigator.vibrate(50);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const extractSharedLinkData = (text = '') => {
        const postMatch = text.match(/(?:https?:\/\/[^\s]+)?\/post\/([a-f0-9]+)/i);
        const profileMatch = text.match(/(?:https?:\/\/[^\s]+)?\/profile\/([a-f0-9]+)/i);
        const storyMatch = text.match(/(?:https?:\/\/[^\s]+)?\/story\/([a-f0-9]+)(?:\/([a-f0-9]+))?/i);

        return {
            postId: postMatch ? postMatch[1] : null,
            profileId: profileMatch ? profileMatch[1] : null,
            storyUserId: storyMatch ? storyMatch[1] : null,
            storyId: storyMatch ? (storyMatch[2] || null) : null,
        };
    };

    const sharedLinkData = extractSharedLinkData(message.content || '');
    const isSharedPost = !!sharedLinkData.postId || !!message.sharedPost?.postId;
    const isSharedProfile = !!sharedLinkData.profileId;
    const isSharedStoryLink = !!sharedLinkData.storyUserId || !!message.storyReply?.storyId;
    const hasSharedLinkCard = isSharedPost || isSharedProfile || isSharedStoryLink;
    const reactions = message.reactions ? Object.entries(message.reactions) : [];
    const reactionGroups = reactions.reduce((acc, [uid, emoji]) => {
        if (!acc[emoji]) acc[emoji] = [];
        acc[emoji].push(uid);
        return acc;
    }, {});

    const handleEditSave = () => { onEdit(message._id, editText); setEditing(false); };

    useEffect(() => {
        if (!isSelected) setShowReactions(false);
    }, [isSelected]);

    const highlightText = (text, highlight) => {
        if (!highlight || !highlight.trim()) return text;
        const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = String(text).split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? <mark key={i} style={{ backgroundColor: '#ffeb3b', color: '#000', padding: '0 2px', borderRadius: '4px', fontWeight: 'bold' }}>{part}</mark> : part
        );
    };

    return (
        <div id={`msg-${message._id}`} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '4px', position: 'relative' }}>

            {isSelected && !isDeleted && (
                <div style={{ position: 'relative', alignSelf: 'center', margin: isOwn ? '0 4px 0 0' : '0 0 0 4px', order: isOwn ? -1 : 1 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowReactions(v => !v); }} aria-expanded={showReactions} aria-haspopup="menu" aria-label="Add reaction" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} title="Add reaction">😊</button>
                    {showReactions && <ReactionPicker onSelect={emoji => onReact(message._id, emoji)} onClose={() => setShowReactions(false)} />}
                </div>
            )}

            <div
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                    // Prevent deselect if clicking inside bubble components
                    if (!editing) e.stopPropagation();
                }}
                style={{
                    maxWidth: '80%',
                    wordBreak: 'break-word',
                    position: 'relative',
                    transform: isSelected ? 'scale(1.02)' : 'none',
                    filter: isSelected ? 'brightness(1.05)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
            >
                {editing ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                            style={{ padding: '8px 12px', borderRadius: '16px', border: '1px solid #808bf5', fontSize: '14px', outline: 'none', background: 'var(--surface-2)', color: 'var(--text-main)', minWidth: '150px' }} />
                        <button onClick={handleEditSave} style={{ background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                        <button onClick={() => setEditing(false)} style={{ background: 'var(--surface-2)', border: 'none', color: 'var(--text-main)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                    </div>
                ) : (
                    <div style={{
                        background: (isSharedPost || (message.storyReply && message.storyReply.isShare)) ? 'none' : (isOwn ? '#808bf5' : 'var(--surface-2)'),
                        color: isOwn ? '#fff' : 'var(--text-main)',
                        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: (isSharedPost || (message.storyReply && message.storyReply.isShare)) ? '0' : '10px 14px',
                        fontSize: '14px',
                        lineHeight: 1.5,
                        boxShadow: (isSelected && !(isSharedPost || (message.storyReply && message.storyReply.isShare))) ? '0 4px 15px rgba(128,139,245,0.3)' : 'none',
                        border: isSelected ? '1px solid rgba(255,255,255,0.3)' : 'none'
                    }}>
                        {isDeleted ? <span style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '12px' }}>🚫 Message deleted</span> : (
                            <>
                                {message.storyReply && (
                                    <div
                                        className="mb-2"
                                        style={{
                                            maxWidth: message.storyReply.isShare ? '240px' : 'none',
                                            width: '100%'
                                        }}
                                    >
                                        {message.storyReply.isShare && message.storyReply.authorName && (
                                            <p className="m-0 mb-2 text-[11px] opacity-70 italic text-center">
                                                Shared {message.storyReply.authorName}'s story
                                            </p>
                                        )}

                                        <div
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const senderId = message.sender?._id || message.senderId;
                                                const match = message.content?.match(/user=([a-f0-9]+)/);
                                                const userId = match ? match[1] : senderId;
                                                const storyId = message.storyReply?.storyId;

                                                if (typeof window.onViewStory === 'function') {
                                                    window.onViewStory(userId, storyId);
                                                    return;
                                                }

                                                try {
                                                    const res = await api.get('/api/story/feed');
                                                    const groups = Array.isArray(res.data) ? res.data : [];
                                                    const idx = groups.findIndex(g => g.user._id.toString() === userId.toString());
                                                    if (idx !== -1) {
                                                        setStoryModalGroups(groups);
                                                        setStoryModalGroupIndex(idx);
                                                        setStoryModalInitialStoryId(storyId || null);
                                                        const mod = await import('./Stories');
                                                        setStoryViewerComp(() => mod.StoryViewer);
                                                        setShareStoryDialogComp(() => mod.ShareStoryDialog);
                                                        setStoryModalOpen(true);
                                                        return;
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to open story modal', err);
                                                }

                                                window.location.href = `/stories?user=${userId}${storyId ? `&story=${storyId}` : ''}`;
                                            }}
                                            className={`cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] ${message.storyReply.isShare ? 'overflow-hidden' : 'p-2.5 flex items-center gap-3'}`}
                                            style={{
                                                background: message.storyReply.isShare ? 'transparent' : (isOwn ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)'),
                                                borderRadius: message.storyReply.isShare ? '20px' : '12px',
                                                border: message.storyReply.isShare ? '2px solid rgba(255,255,255,0.8)' : 'none',
                                                aspectRatio: message.storyReply.isShare ? '9/16' : 'auto',
                                                position: 'relative'
                                            }}
                                        >
                                            {message.storyReply.isShare ? (
                                                <>
                                                    {/* Rich Share Card UI */}
                                                    <div className="absolute inset-0 bg-black/20">
                                                        {message.storyReply.mediaUrl ? (
                                                            <ProgressiveImage
                                                                src={message.storyReply.mediaUrl}
                                                                alt="Story Content"
                                                                objectFit="cover"
                                                                placeholderColor="#111"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-4xl">✨</div>
                                                        )}
                                                    </div>

                                                    {/* Author Overlay */}
                                                    {message.storyReply.authorName && (
                                                        <div className="absolute top-3 left-3 flex items-center gap-2 z-10 px-2 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
                                                            <img
                                                                src={message.storyReply.authorProfilePicture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'}
                                                                className="w-5 h-5 rounded-full object-cover border border-white/20"
                                                                alt=""
                                                            />
                                                            <span className="text-[10px] font-bold text-white truncate max-w-[80px]">
                                                                {message.storyReply.authorUsername || message.storyReply.authorName}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Video Indicator */}
                                                    {message.storyReply.mediaType === 'video' && (
                                                        <div className="absolute bottom-3 right-3 z-10 p-2 bg-black/40 backdrop-blur-md rounded-full">
                                                            <i className="pi pi-play text-white text-[10px]"></i>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                /* Legacy / Reply UI */
                                                <>
                                                    {message.storyReply.mediaUrl ? (
                                                        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                                                            <img src={message.storyReply.mediaUrl} loading="lazy" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} alt="" />
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <i className="pi pi-play" style={{ color: '#fff', fontSize: '12px' }}></i>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: 44, height: 44, borderRadius: '8px', background: '#808bf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <i className="pi pi-bolt" style={{ color: '#fff' }}></i>
                                                        </div>
                                                    )}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, opacity: 0.9 }}>{message.storyReply.isShare ? '' : 'Replied to story'}</p>
                                                        <p style={{ margin: 0, fontSize: '10px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tap to view ✨</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {isSharedPost && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setSelectedPostId(message.sharedPost?.postId || sharedLinkData.postId); setShowPostModal(true); }}
                                        className="cursor-pointer mb-2 overflow-hidden transition-all hover:brightness-110 active:scale-[0.98]"
                                        style={{
                                            background: isOwn ? '#808bf5' : 'rgba(0, 0, 0, 0.2)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '24px',
                                            width: '100%',
                                            maxWidth: '280px',
                                            color: '#fff'
                                        }}
                                    >
                                        {message.sharedPost ? (
                                            <>
                                                {/* Header: Author Info */}
                                                <div className="flex items-center gap-2 p-3 border-b border-white/5">
                                                    <img
                                                        src={message.sharedPost.authorProfilePicture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'}
                                                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                                                        alt=""
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[12px] font-bold truncate opacity-90">{message.sharedPost.authorName}</span>
                                                            <i className="pi pi-check-circle text-[#3897f0] text-[10px]"></i>
                                                        </div>
                                                        <p className="m-0 text-[10px] opacity-50 truncate">@{message.sharedPost.authorUsername}</p>
                                                    </div>
                                                </div>

                                                {/* Media Preview */}
                                                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1/1', maxHeight: '300px' }}>
                                                    {message.sharedPost.mediaUrl ? (
                                                        <ProgressiveImage
                                                            src={message.sharedPost.mediaUrl}
                                                            alt="Post Content"
                                                            objectFit="cover"
                                                            placeholderColor="rgba(0, 0, 0, 0.4)"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-black/20 text-4xl">📦</div>
                                                    )}
                                                    {message.sharedPost.mediaType === 'video' && (
                                                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md rounded-lg p-1">
                                                            <i className="pi pi-video text-white text-[10px]"></i>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Footer: Caption */}
                                                <div className="p-3 bg-black/5">
                                                    <p className="m-0 text-[11px] line-clamp-2 leading-relaxed">
                                                        <span className="font-bold mr-1">{message.sharedPost.authorUsername}</span>
                                                        <span className="opacity-80">{message.sharedPost.caption}</span>
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            /* Fallback for legacy messages */
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="w-12 h-12 rounded-lg bg-[#808bf5]/20 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                                                    {message.media?.url ? (
                                                        <ProgressiveImage
                                                            src={message.media.url}
                                                            alt="Post Preview"
                                                            objectFit="cover"
                                                            placeholderColor="rgba(128, 139, 245, 0.1)"
                                                        />
                                                    ) : (
                                                        '📦'
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="m-0 text-[12px] font-bold opacity-90">Shared Post</p>
                                                    <p className="m-0 text-[10px] opacity-60 truncate">Tap to view post</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isSharedProfile && (
                                    <div onClick={(e) => { e.stopPropagation(); setSelectedProfileId(sharedLinkData.profileId); setShowProfileModal(true); }} className="cursor-pointer p-3 rounded-xl mb-2 flex items-center gap-4 transition-all" style={{ background: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--surface-3)', border: isOwn ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)' }}>
                                        <div className="w-10 h-10 rounded-lg bg-[#808bf5]/20 flex items-center justify-center text-lg flex-shrink-0">👤</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="m-0 text-[12px] font-bold opacity-90">Shared Profile</p>
                                            <p className="m-0 text-[10px] opacity-60 truncate">Tap to view profile</p>
                                        </div>
                                    </div>
                                )}
                                {isSharedStoryLink && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (typeof window.onViewStory === 'function') {
                                                window.onViewStory(sharedLinkData.storyUserId, sharedLinkData.storyId);
                                            } else {
                                                window.location.href = `/story/${sharedLinkData.storyUserId}${sharedLinkData.storyId ? `/${sharedLinkData.storyId}` : ''}`;
                                            }
                                        }}
                                        style={{ cursor: 'pointer', padding: '0', background: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)', borderRadius: '12px', border: isOwn ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.1)', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}>
                                    </div>
                                )}
                                {message.media?.url && (
                                    <div style={{ marginBottom: message.content ? '8px' : 0 }}>
                                        {message.media.type === 'image' && <img src={message.media.url} alt="" loading="lazy" style={{
                                            maxWidth: '100%',
                                            maxHeight: '250px', borderRadius: '12px', display: 'block'
                                        }} />}
                                        {message.media.type === 'audio' && <VoiceNotePlayer url={message.media.url} duration={message.media.size} />}
                                        {message.media.type === 'video' && <video src={message.media.url} controls style={{ maxWidth: '200px', borderRadius: '12px' }} />}
                                        {message.media.type === 'file' && <a href={message.media.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOwn ? '#fff' : '#808bf5', textDecoration: 'none', fontSize: '13px' }}>📎 {message.media.name || 'File'}</a>}
                                    </div>
                                )}
                                {!hasSharedLinkCard && message.content && <p style={{ margin: 0 }}>{highlightText(message.content, searchQ)}</p>}
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
                                style={{ background: users.includes(loggeduser._id) ? 'var(--bg-main)' : 'var(--surface-2)', border: users.includes(loggeduser._id) ? '1px solid var(--border-color)' : '1px solid var(--border-color)', borderRadius: '14px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500, transition: 'all 0.2s', boxShadow: users.includes(loggeduser._id) ? '0 1px 3px rgba(168,85,247,0.2)' : 'none' }}>
                                {emoji} {users.length > 1 && <span style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 600 }}>{users.length}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {isSelected && isOwn && !isDeleted && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ position: 'absolute', right: 0, top: '-36px', display: 'flex', gap: '4px', background: 'var(--surface-1)', borderRadius: '12px', padding: '4px 8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', zIndex: 10 }}>
                        <button type="button" aria-label="Edit message" onClick={(e) => { e.stopPropagation(); setEditing(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-main)', padding: '4px', borderRadius: '6px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️</button>
                        <button type="button" aria-label="Delete message" onClick={(e) => { e.stopPropagation(); onDelete(message._id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#ef4444', padding: '4px', borderRadius: '6px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️</button>
                    </div>
                )}

                {showPostModal && selectedPostId && (
                    <Dialog
                        showHeader={false}
                        visible={showPostModal}
                        style={{ width: isDesktop ? '95vw' : '100vw', maxWidth: isDesktop ? '1200px' : 'none', height: isDesktop ? '90vh' : '100dvh' }}
                        onHide={() => setShowPostModal(false)}
                        contentStyle={{ padding: 0, borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', background: 'transparent' }}
                        baseZIndex={20000}
                        dismissableMask
                        blockScroll={true}
                        closable={false}
                    >
                        <div className="relative bg-[var(--surface-1)] h-full w-full" style={{ borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', border: isDesktop ? '1px solid var(--border-color)' : 'none' }}>
                            <button
                                onClick={() => setShowPostModal(false)}
                                className="absolute top-4 left-4 z-[20005] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg"
                            >
                                <i className="pi pi-times text-sm"></i>
                            </button>
                            <React.Suspense fallback={<div className="p-20 text-center text-[var(--text-sub)] bg-[var(--surface-1)]">
                                <div className="inline-block w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="font-medium">Loading Post...</p>
                            </div>}>
                                <PostDetail postId={selectedPostId} onHide={() => setShowPostModal(false)} />
                            </React.Suspense>
                        </div>
                    </Dialog>
                )}
                {showProfileModal && selectedProfileId && (
                    <Dialog
                        header="Profile"
                        aria-label="Profile"
                        aria-modal="true"
                        role="dialog"
                        visible={showProfileModal}
                        appendTo={document.body}
                        style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }}
                        onHide={() => setShowProfileModal(false)}
                        modal
                    >
                        <UserProfile id={selectedProfileId} onClose={() => setShowProfileModal(false)} />
                    </Dialog>
                )}
                {storyModalOpen && StoryViewerComp && (
                    <Dialog
                        header={null}
                        aria-label="Story viewer"
                        aria-modal="true"
                        role="dialog"
                        visible={storyModalOpen}
                        appendTo={document.body}
                        baseZIndex={100000}
                        style={{ width: '100vw', maxWidth: '480px', height: '100vh', padding: 0 }}
                        onHide={() => setStoryModalOpen(false)}
                        modal
                        className="p-0 overflow-hidden story-viewer-dialog"
                    >
                        <div style={{ width: '100%', height: '100%' }}>
                            <StoryViewerComp
                                groups={storyModalGroups}
                                startGroupIndex={storyModalGroupIndex}
                                initialStoryId={storyModalInitialStoryId}
                                onClose={() => setStoryModalOpen(false)}
                                loggeduser={loggeduser}
                                onStoryDeleted={() => setStoryModalOpen(false)}
                                onStoryLiked={() => { }}
                                onOpenPostDetail={(postId) => { setSelectedPostId(postId); setShowPostModal(true); }}
                                onShareStory={(s) => {
                                    setSharingStory(s);
                                    setShareOpen(true);
                                }}
                            />
                        </div>
                    </Dialog>
                )}
                {shareOpen && ShareStoryDialogComp && (
                    <ShareStoryDialogComp
                        visible={shareOpen}
                        onHide={() => setShareOpen(false)}
                        story={sharingStory}
                        loggeduser={loggeduser}
                    />
                )}
            </div>
        </div>
    );
};

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
const ChatPanel = ({
    participantId,
    lastMessage,
    isSearching = false,
    setIsSearching = () => { },
    searchQ = '',
    setSearchQ = () => { },
    searchIndex = 0,
    setSearchIndex = () => { },
    setSearchCount = () => { },
    onConversationIdFetched,
    refreshKey
}) => {
    const user = useAuthStore(s => s.user);
    const setTyping = useConversationStore(s => s.setTyping);
    const clearTyping = useConversationStore(s => s.clearTyping);
    const isTyping = useConversationStore(s => s.isTyping);
    const getTypingName = useConversationStore(s => s.getTypingName);
    const chatRef = useRef(null);
    const shouldAutoScroll = useRef(true);
    const fileInputRef = useRef(null);
    const typingTimer = useRef(null);
    const conversationIdRef = useRef(null);

    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [selectedMessageId, setSelectedMessageId] = useState(null);

    // ✅ Track conversation ID and notify parent
    useEffect(() => {
        if (conversationId && onConversationIdFetched) {
            onConversationIdFetched(conversationId);
        }
    }, [conversationId, onConversationIdFetched]);

    // ✅ Track search matches (Latest first)
    const searchMatches = useMemo(() => {
        if (!searchQ || !searchQ.trim()) return [];
        return messages
            .filter(m => m.content?.toLowerCase().includes(searchQ.toLowerCase()))
            .map(m => m._id)
            .reverse(); // Reverse so index 0 is the most recent
    }, [messages, searchQ]);

    useEffect(() => {
        setSearchCount(searchMatches.length);
    }, [searchMatches, setSearchCount]);

    // ✅ Scroll to current search match
    useEffect(() => {
        if (isSearching && searchMatches.length > 0 && searchMatches[searchIndex]) {
            const el = document.getElementById(`msg-${searchMatches[searchIndex]}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [searchIndex, searchMatches, isSearching]);

    // ✅ TanStack Query mutations
    const sendMessageMut = useSendMessage();
    const editMessageMut = useEditMessage();
    const deleteMessageMut = useDeleteMessage();
    const reactToMessageMut = useReactToMessage();
    const { mutate: markRead } = useMarkMessagesRead();

    // ✅ Fetch messages from backend directly
    const fetchMessages = useCallback(async () => {
        if (!user?._id || !participantId) return;
        setLoading(true);
        try {
            const res = await api.post(`/api/conversation/messages`, {
                recipientId: participantId,
                limit: 30
            });
            const fetchedMessages = res.data.messages || [];
            const fetchedConversationId = res.data.conversation?._id || null;
            const fetchedHasMore = res.data.hasMore || false;

            setMessages(fetchedMessages);
            setConversationId(fetchedConversationId);
            setHasMore(fetchedHasMore);
            conversationIdRef.current = fetchedConversationId;

            // When opening chat, mark any existing incoming unread messages as read.
            const unreadIncomingIds = fetchedMessages
                .filter(m => (m.sender?.toString?.() || m.senderId) !== user?._id && !m.isRead)
                .map(m => m._id);

            if (fetchedConversationId && unreadIncomingIds.length) {
                markRead({
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
    }, [user?._id, participantId, markRead]);

    const fetchMoreMessages = useCallback(async () => {
        if (loadingMore || !hasMore || !messages.length || !participantId) return;

        setLoadingMore(true);
        const before = messages[0].createdAt;
        const oldScrollHeight = chatRef.current?.scrollHeight;

        try {
            const res = await api.post(`/api/conversation/messages`, {
                recipientId: participantId,
                before,
                limit: 30
            });

            const olderMessages = res.data.messages || [];
            const fetchedHasMore = res.data.hasMore || false;

            if (olderMessages.length > 0) {
                setMessages(prev => [...olderMessages, ...prev]);
                setHasMore(fetchedHasMore);

                // Preserve scroll position
                setTimeout(() => {
                    if (chatRef.current) {
                        chatRef.current.scrollTop = chatRef.current.scrollHeight - oldScrollHeight;
                    }
                }, 0);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Failed to fetch more messages', err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, messages, participantId]);

    const handleScroll = (e) => {
        const target = e.target;
        const { scrollTop, scrollHeight, clientHeight } = target;

        // If user scrolled to top, fetch older messages
        if (scrollTop === 0 && hasMore && !loadingMore) {
            fetchMoreMessages();
        }

        // Track whether we should auto-scroll on new messages
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        shouldAutoScroll.current = distanceFromBottom < 200;
        setShowScrollBottom(distanceFromBottom > 400);

        // Deselect message on scroll
        if (selectedMessageId) setSelectedMessageId(null);
    };

    const scrollToBottom = () => {
        if (chatRef.current) {
            chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
        }
    };

    useEffect(() => { fetchMessages(); }, [fetchMessages, refreshKey]);

    useEffect(() => {
        if (chatRef.current && !loading && !loadingMore) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [loading, conversationId, loadingMore]); // Added loadingMore to satisfy ESLint, logic prevents jumping

    // Auto-scroll when new messages arrive, but only if the user hasn't scrolled up
    useEffect(() => {
        if (!chatRef.current) return;
        if (shouldAutoScroll.current) {
            // use smooth scroll so UX is nicer
            try {
                chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
            } catch (err) {
                chatRef.current.scrollTop = chatRef.current.scrollHeight;
            }
        }
    }, [messages.length]);

    // Keep chat at bottom on window resize if appropriate
    useEffect(() => {
        const onResize = () => {
            if (!chatRef.current) return;
            if (shouldAutoScroll.current) {
                chatRef.current.scrollTop = chatRef.current.scrollHeight;
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // ✅ Socket listeners with stable ref — no stale closure issues
    useEffect(() => {
        const handleReceive = (message) => {
            // Only handle messages from current participant
            if (String(message.senderId) !== String(participantId) && String(message.sender) !== String(participantId)) return;

            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => String(m._id) === String(message._id))) return prev;
                return [...prev, message];
            });

            // Mark as read
            if (conversationIdRef.current) {
                markRead({
                    unreadMessageIds: [message._id],
                    lastMessage: message._id,
                    conversationId: conversationIdRef.current,
                });
                socket.emit('readMessage', { messageId: message._id, recipientId: message.senderId || message.sender });
            }
        };

        const handleSeen = ({ messageId }) => {
            setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, isRead: true } : m));
        };

        const handleEdited = ({ messageId, content, conversationId: cid }) => {
            setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, content, edited: true } : m));
        };

        const handleDeleted = ({ messageId }) => {
            setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
        };

        const handleReaction = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, reactions } : m));
        };

        const handleTyping = ({ senderName }) => {
            if (conversationIdRef.current) setTyping(conversationIdRef.current, senderName);
        };

        const handleStopTyping = () => {
            if (conversationIdRef.current) clearTyping(conversationIdRef.current);
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
    }, [participantId, markRead, setTyping, clearTyping]); // ✅ only re-run when participantId or stable handlers change

    // ─── SEND ────────────────────────────────────────────────────────────────
    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || (!conversationId && !participantId)) return;

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

            // If this was a new conversation, set the ID
            if (!conversationId && res.data.conversationId) {
                setConversationId(res.data.conversationId);
                conversationIdRef.current = res.data.conversationId;
            }

            // socket.emit('sendMessage', ...) removed: handled by REST API response emission

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
        setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, content, edited: true } : m));
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
            setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, content: m.content, edited: m.edited } : m));
            toast.error('Edit failed');
        }
    };

    // ─── DELETE ───────────────────────────────────────────────────────────────
    const handleDelete = async (messageId) => {
        confirmDialog({
            message: 'Are you sure you want to delete this message?',
            header: 'Delete Message',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
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
                    setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, deletedAt: null, content: m.content } : m));
                    toast.error('Delete failed');
                }
            }
        });
    };

    // ─── MEDIA UPLOAD ─────────────────────────────────────────────────────────
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;
        setUploading(true);
        try {
            let mediaUrl, mediaType;
            if (file.type.startsWith('image/')) {
                const result = await uploadToCloudinary(file);
                mediaUrl = typeof result === 'string' ? result : result?.url;
                mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
                const result = await uploadVideoToCloudinary(file);
                mediaUrl = typeof result === 'string' ? result : result?.url;
                mediaType = 'video';
            } else {
                const result = await uploadToCloudinary(file);
                mediaUrl = typeof result === 'string' ? result : result?.url;
                mediaType = 'file';
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

    const isTypingOther = conversationId && isTyping(conversationId);
    const typingName = conversationId ? getTypingName(conversationId) : null;

    const displayMessages = messages;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative'
        }}>



            {/* Messages */}
            <div
                ref={chatRef}
                onScroll={handleScroll}
                onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedMessageId(null);
                }}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>Loading...</div>
                ) : (
                    <>
                        {loadingMore && (
                            <div style={{ textAlign: 'center', padding: '10px', color: '#808bf5' }}>
                                <i className="pi pi-spin pi-spinner" style={{ fontSize: '14px' }}></i>
                            </div>
                        )}
                        {!hasMore && (
                            <div style={{ textAlign: 'center', padding: '10px 20px', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#808bf5', marginTop: '12px' }}>✨ Reached the start of the chat ✨</p>
                            </div>
                        )}
                        {displayMessages.map(message => (
                            <MessageBubble key={message._id} message={message}
                                isOwn={message.sender?.toString() === user?._id?.toString() || message.senderId === user?._id}
                                conversationId={conversationId}
                                loggeduser={user}
                                onReact={handleReact}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                searchQ={searchQ}
                                isSelected={selectedMessageId === message._id}
                                onSelect={() => setSelectedMessageId(message._id)}
                            />
                        ))}
                    </>
                )}

                {isTypingOther && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <div style={{ background: 'var(--surface-2)', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginRight: '4px' }}>{typingName}</span>
                            {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-sub)', animation: `typingDot 1s ${i * 0.2}s infinite` }} />)}
                        </div>
                    </div>
                )}
            </div>

            {showScrollBottom && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-20 right-6 w-12 h-12 rounded-full bg-indigo-500 text-white shadow-2xl flex items-center justify-center cursor-pointer animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300 hover:scale-110 active:scale-95 transition-all z-50 border-0"
                    style={{
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.5)',
                        border: '2px solid rgba(255,255,255,0.1)'
                    }}
                    title="Scroll to bottom"
                >
                    <i className="pi pi-chevron-down text-xl"></i>
                </button>
            )}

            {/* Input */}

            <div style={{
                padding: '10px 12px',
                width: '100%',
                background: 'var(--surface-1)',
                zIndex: 10,
                borderTop: '1px solid var(--border-color)',
                boxSizing: 'border-box'
            }}>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '18px', padding: '4px', flexShrink: 0 }}>
                        {uploading ? '⏳' : '📎'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleFileSelect} style={{ display: 'none' }} />
                    <input type="text" value={text} onChange={handleInputChange} placeholder="Type your message..."
                        style={{ flex: 1, padding: '10px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', background: 'var(--surface-2)', color: 'var(--text-main)' }}
                        onFocus={e => e.target.style.borderColor = '#808bf5'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                    <button type="submit" disabled={!text.trim() && !uploading}
                        style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s', background: text.trim() ? '#808bf5' : 'var(--surface-2)' }}>
                        <i className="pi pi-send" style={{ fontSize: '16px', color: text.trim() ? '#fff' : 'var(--text-sub)' }}></i>
                    </button>
                </form>
            </div>

            <style>{`@keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }`}</style>
        </div>
    );
};

export default ChatPanel;
