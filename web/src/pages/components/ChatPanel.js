import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import useE2eeStore from '../../store/zustand/useE2eeStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { encryptFile, generateSymmetricKey, exportSymmetricKey, decryptFile, importSymmetricKey } from '../../utils/cryptoUtils';
import dbService from '../../utils/indexedDb';
import { socket } from '../../socket';
import { uploadMedia, uploadVideo } from '../../utils/cloudinary';
import { uploadToDrive, getFileIcon, formatFileSize } from '../../utils/drive';
import { getMediaThumbnail } from '../../utils/mediaUtils';

import toast from 'react-hot-toast';
import { useSendMessage, useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessagesRead } from '../../hooks/queries/useConversationQueries';
import PostDetail from './PostDetail';
// import UserProfile from './UserProfile';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import { Image } from 'primereact/image';
import ProgressiveImage from './ui/ProgressiveImage';
import useWindowWidth from '../../hooks/useWindowWidth';
import usePostStore from '../../store/zustand/usePostStore';
import { USER_DEFAULT_IMAGE } from '../../utils/constantMediaVariable';

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const IconSmile = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);
const IconReply = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
);
const IconCopy = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);
const IconEdit = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);
const IconTrash = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
);
const IconInfo = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);
const IconSend = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);
const IconPaperclip = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);
const IconX = ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);
const IconDoubleCheck = ({ status }) => {
    if (status === 'read') {
        // Double blue checkmark
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3897f0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 6L8.5 15L5 11.5" />
                <path d="M22 6L13.5 15L11.5 13" />
            </svg>
        );
    } else if (status === 'delivered') {
        // Double gray checkmark
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 6L8.5 15L5 11.5" />
                <path d="M22 6L13.5 15L11.5 13" />
            </svg>
        );
    } else {
        // Single gray checkmark
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        );
    }
};

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
            <button type="button" onClick={toggle} aria-pressed={playing} aria-label={playing ? 'Pause voice note' : 'Play voice note'}
                style={{ width: 28, height: 28, borderRadius: '50%', background: '#808bf5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
        const btn = ref.current?.querySelectorAll('button')[focusIndex];
        if (btn) btn.focus();
    }, [focusIndex]);

    const onKeyDown = (e) => {
        const total = EMOJI_REACTIONS.length;
        if (e.key === 'ArrowRight') { e.preventDefault(); setFocusIndex(i => (i + 1) % total); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); setFocusIndex(i => (i - 1 + total) % total); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const emoji = EMOJI_REACTIONS[focusIndex];
            if (emoji) { onSelect(emoji); onClose(); }
        }
    };

    return (
        <div
            ref={ref} tabIndex={0} onKeyDown={onKeyDown} role="menu" aria-label="Emoji reactions"
            style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--surface-1)', borderRadius: '100px', padding: '6px 10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', gap: '2px',
                zIndex: 9999, border: '1px solid var(--border-color)', whiteSpace: 'nowrap'
            }}
        >
            {EMOJI_REACTIONS.map((emoji, idx) => (
                <button
                    key={emoji} type="button" role="menuitem" aria-label={`React ${emoji}`}
                    onClick={() => { onSelect(emoji); onClose(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px', borderRadius: '8px', transition: 'transform 0.15s', lineHeight: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; setFocusIndex(idx); }}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >{emoji}</button>
            ))}
        </div>
    );
};

// ─── TOOLBAR BUTTON ───────────────────────────────────────────────────────────
const ToolbarBtn = ({ onClick, title, danger = false, children }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            type="button" title={title} onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hovered ? (danger ? 'rgba(239,68,68,0.1)' : 'var(--surface-3)') : 'none',
                color: hovered && danger ? '#ef4444' : 'var(--text-sub)',
                transition: 'background 0.15s, color 0.15s',
                padding: 0,
                flexShrink: 0,
            }}
        >{children}</button>
    );
};

// ─── DECRYPTED MEDIA HELPERS ──────────────────────────────────────────────────
const decryptionCache = new Map(); // url -> localBlobUrl

const DecryptedImage = ({ url, fileKey, iv, alt, style }) => {
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!url) return;
        if (!fileKey || !iv) {
            setDecryptedUrl(url);
            setLoading(false);
            return;
        }

        if (decryptionCache.has(url)) {
            setDecryptedUrl(decryptionCache.get(url));
            setLoading(false);
            return;
        }

        let active = true;
        let localBlobUrl = null;
        const decrypt = async () => {
            try {
                const cachedBlob = await dbService.getMedia(url);
                if (cachedBlob) {
                    localBlobUrl = URL.createObjectURL(cachedBlob);
                    decryptionCache.set(url, localBlobUrl);
                    if (active) {
                        setDecryptedUrl(localBlobUrl);
                        setLoading(false);
                    }
                } else {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const cryptoKey = await importSymmetricKey(fileKey);
                    const decryptedBuffer = await decryptFile(arrayBuffer, iv, cryptoKey);
                    const blob = new Blob([decryptedBuffer], { type: 'image/jpeg' });

                    await dbService.setMedia(url, blob);

                    localBlobUrl = URL.createObjectURL(blob);
                    decryptionCache.set(url, localBlobUrl);
                    if (active) {
                        setDecryptedUrl(localBlobUrl);
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error("Failed to decrypt image:", err);
                if (active) setLoading(false);
            }
        };
        decrypt();
        return () => {
            active = false;
            // Only revoke if not successfully cached (e.g. cancelled mid-flight)
            if (localBlobUrl && !decryptionCache.has(url)) {
                URL.revokeObjectURL(localBlobUrl);
            }
        };
    }, [url, fileKey, iv]);

    if (loading) {
        return (
            <div style={{ width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3)', borderRadius: '12px' }}>
                <i className="pi pi-spin pi-spinner text-[#808bf5]" />
            </div>
        );
    }

    if (!decryptedUrl) {
        return (
            <div style={{ padding: '8px', color: 'var(--text-sub)', fontSize: '12px' }}>
                🔑 Failed to decrypt media
            </div>
        );
    }

    return <ProgressiveImage src={decryptedUrl} alt={alt} style={style} />;
};

const DecryptedAudio = ({ url, fileKey, iv, duration }) => {
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!url) return;
        if (!fileKey || !iv) {
            setDecryptedUrl(url);
            setLoading(false);
            return;
        }

        if (decryptionCache.has(url)) {
            setDecryptedUrl(decryptionCache.get(url));
            setLoading(false);
            return;
        }

        let active = true;
        let localBlobUrl = null;
        const decrypt = async () => {
            try {
                const cachedBlob = await dbService.getMedia(url);
                if (cachedBlob) {
                    localBlobUrl = URL.createObjectURL(cachedBlob);
                    decryptionCache.set(url, localBlobUrl);
                    if (active) {
                        setDecryptedUrl(localBlobUrl);
                        setLoading(false);
                    }
                } else {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const cryptoKey = await importSymmetricKey(fileKey);
                    const decryptedBuffer = await decryptFile(arrayBuffer, iv, cryptoKey);
                    const blob = new Blob([decryptedBuffer], { type: 'audio/mp3' });

                    await dbService.setMedia(url, blob);

                    localBlobUrl = URL.createObjectURL(blob);
                    decryptionCache.set(url, localBlobUrl);
                    if (active) {
                        setDecryptedUrl(localBlobUrl);
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error("Failed to decrypt audio:", err);
                if (active) setLoading(false);
            }
        };
        decrypt();
        return () => {
            active = false;
            // Only revoke if not successfully cached (e.g. cancelled mid-flight)
            if (localBlobUrl && !decryptionCache.has(url)) {
                URL.revokeObjectURL(localBlobUrl);
            }
        };
    }, [url, fileKey, iv]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', minWidth: '180px' }}>
                <i className="pi pi-spin pi-spinner text-[#808bf5]" />
            </div>
        );
    }

    if (!decryptedUrl) {
        return (
            <div style={{ padding: '8px', color: 'var(--text-sub)', fontSize: '12px' }}>
                🔑 Decryption error
            </div>
        );
    }

    return <VoiceNotePlayer url={decryptedUrl} duration={duration} />;
};

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwn, isGroup, conversationId, loggeduser, onReact, onEdit, onDelete, onShowInfo, searchQ, isSelected, onSelect, onReply }) => {
    const activeParticipant = useConversationStore(s => s.activeParticipant);

    let checkmarkStatus = 'sent';
    if (isOwn) {
        if (isGroup) {
            const otherParticipants = activeParticipant?.participants?.filter(p => String(p.userId) !== String(loggeduser?._id)) || [];
            const otherReaders = (message.readBy || []).filter(r => {
                const rId = r._id || r;
                return String(rId) !== String(loggeduser?._id);
            });

            if (otherReaders.length === 0) {
                checkmarkStatus = 'sent';
            } else if (otherReaders.length < otherParticipants.length) {
                checkmarkStatus = 'delivered';
            } else {
                checkmarkStatus = 'read';
            }
        } else {
            checkmarkStatus = message.isRead ? 'read' : (message.isDelivered ? 'delivered' : 'sent');
        }
    }

    const [showReactions, setShowReactions] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const [showPostModal, setShowPostModal] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const setProfileDetailId = usePostStore(s => s.setProfileDetailId);
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
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchStartX = useRef(null);
    const isSwiping = useRef(false);

    const handleTouchStart = (e) => {
        if (isDeleted) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        touchStartX.current = clientX;
        isSwiping.current = true;
        longPressTimer.current = setTimeout(() => {
            if (isSwiping.current && Math.abs(swipeOffset) < 10) {
                onSelect();
                if (window.navigator?.vibrate) window.navigator.vibrate(50);
            }
        }, 500);
    };

    const handleTouchMove = (e) => {
        if (!isSwiping.current || isDeleted) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const diff = clientX - touchStartX.current;
        if (diff > 0) {
            setSwipeOffset(Math.min(diff, 60));
        }
    };

    const handleTouchEnd = () => {
        if (isSwiping.current && swipeOffset >= 50) {
            onReply && onReply(message);
            if (window.navigator?.vibrate) window.navigator.vibrate(30);
        }
        setSwipeOffset(0);
        isSwiping.current = false;
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
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

    const handleCopy = (e) => {
        e.stopPropagation();
        if (message.content) {
            navigator.clipboard.writeText(message.content).then(() => toast.success('Copied'));
        }
        onSelect(null);
    };

    useEffect(() => {
        if (!isSelected) { setShowReactions(false); return; }
        const timer = setTimeout(() => onSelect(null), 5000);
        return () => clearTimeout(timer);
    }, [isSelected, onSelect]);

    const highlightText = (text, highlight) => {
        if (!highlight || !highlight.trim()) return text;
        const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = String(text).split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? <mark key={i} style={{ backgroundColor: '#ffeb3b', color: '#000', padding: '0 2px', borderRadius: '4px', fontWeight: 'bold' }}>{part}</mark> : part
        );
    };

    const scrollToReplied = () => {
        const el = document.getElementById(`msg-${message.replyTo._id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'background 0.5s';
            el.style.backgroundColor = 'var(--surface-3)';
            setTimeout(() => { el.style.backgroundColor = 'transparent'; }, 1000);
        }
    };

    const senderObj = message.sender && typeof message.sender === 'object' ? message.sender : null;
    const senderNameStr = message.senderName || senderObj?.fullname || 'Someone';
    const senderAvatarStr = senderObj?.profile_picture || senderObj?.profilePicture || USER_DEFAULT_IMAGE;

    return (
        <div id={`msg-${message._id}`} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '6px', position: 'relative', gap: '8px' }}>
            {!isOwn && isGroup && (
                <div style={{ alignSelf: 'flex-end', marginBottom: '14px', flexShrink: 0 }}>
                    <img
                        src={senderAvatarStr}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    />
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', flex: 1, minWidth: 0 }}>
                {!isOwn && isGroup && (
                    <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, marginBottom: '2px', marginLeft: '4px' }}>
                        {senderNameStr}
                    </span>
                )}

                {/* ── Thread indicator line above bubble ── */}
                {message.replyTo && !isDeleted && (
                    <div
                        onClick={scrollToReplied}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            fontSize: '11px', color: 'var(--text-sub)',
                            marginBottom: '3px', cursor: 'pointer',
                            marginRight: isOwn ? '12px' : 0,
                            marginLeft: isOwn ? 0 : '12px',
                            flexDirection: isOwn ? 'row-reverse' : 'row',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#808bf5'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sub)'}
                    >
                        {/* The L-shaped thread curve */}
                        <div style={{
                            width: 16, height: 12,
                            borderLeft: '2px solid var(--border-color)',
                            borderBottom: '2px solid var(--border-color)',
                            borderBottomLeftRadius: 5,
                            flexShrink: 0,
                            transform: isOwn ? 'scaleX(-1)' : 'none',
                        }} />
                        <span style={{ fontWeight: 500 }}>
                            {isOwn ? 'You' : (message.sender?.fullname?.split(' ')[0] || '')}
                            {' replied to '}
                            {message.replyTo.sender?.fullname?.split(' ')[0] || message.replyTo.senderName || 'User'}
                        </span>
                    </div>
                )}

                <div
                    onMouseDown={handleTouchStart}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onDoubleClick={(e) => { e.stopPropagation(); if (!isDeleted) onReply && onReply(message); }}
                    onClick={(e) => { if (!editing) e.stopPropagation(); }}
                    style={{
                        maxWidth: '80%', wordBreak: 'break-word', position: 'relative',
                        transform: `translateX(${swipeOffset}px) ${isSelected ? 'scale(1.02)' : 'scale(1)'}`,
                        filter: isSelected ? 'brightness(1.05)' : 'none',
                        transition: isSwiping.current ? 'none' : 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                >
                    {/* Swipe Reply Indicator */}
                    {swipeOffset > 0 && (
                        <div style={{
                            position: 'absolute', left: -40, top: '50%',
                            transform: 'translateY(-50%)', opacity: swipeOffset / 50, transition: 'opacity 0.1s'
                        }}>
                            <div style={{
                                background: 'var(--surface-2)', borderRadius: '50%', width: 30, height: 30,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)',
                                color: '#808bf5'
                            }}>
                                <IconReply />
                            </div>
                        </div>
                    )}

                    {editing ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                                style={{ padding: '8px 12px', borderRadius: '16px', border: '1px solid #808bf5', fontSize: '14px', outline: 'none', background: 'var(--surface-2)', color: 'var(--text-main)', minWidth: '150px' }} />
                            <button onClick={handleEditSave} style={{ background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                            <button onClick={() => setEditing(false)} style={{ background: 'var(--surface-2)', border: 'none', color: 'var(--text-main)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                        </div>
                    ) : (
                        <div style={{
                            background: (isSharedPost || (message.storyReply && message.storyReply.isShare)) ? 'none' : (isOwn ? 'linear-gradient(135deg, #808bf5 0%, #6366f1 100%)' : 'var(--surface-2)'),
                            color: isOwn ? '#fff' : 'var(--text-main)',
                            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            padding: (isSharedPost || (message.storyReply && message.storyReply.isShare)) ? '0' : '10px 14px',
                            fontSize: '14px', lineHeight: 1.5,
                            boxShadow: isSelected && !(isSharedPost || (message.storyReply && message.storyReply.isShare)) ? '0 4px 15px rgba(128,139,245,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                            border: isSelected ? '1px solid rgba(255,255,255,0.3)' : 'none'
                        }}>
                            {isDeleted ? (
                                <span style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                                    Message deleted
                                </span>
                            ) : (
                                <>
                                    {/* ── Reply quote block inside bubble ── */}
                                    {message.replyTo && (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); scrollToReplied(); }}
                                            style={{
                                                background: isOwn ? 'rgba(0,0,0,0.12)' : 'var(--surface-3)',
                                                borderLeft: '3px solid ' + (isOwn ? 'rgba(255,255,255,0.5)' : '#808bf5'),
                                                borderRadius: '0 8px 8px 0',
                                                padding: '6px 10px',
                                                marginBottom: '8px',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = isOwn ? 'rgba(0,0,0,0.18)' : 'var(--surface-3)'}
                                            onMouseLeave={e => e.currentTarget.style.background = isOwn ? 'rgba(0,0,0,0.12)' : 'var(--surface-3)'}
                                        >
                                            <div style={{
                                                fontWeight: 600, fontSize: '11px', marginBottom: '2px',
                                                color: isOwn ? 'rgba(255,255,255,0.9)' : '#808bf5'
                                            }}>
                                                {message.replyTo.sender?.fullname || 'User'}
                                            </div>
                                            <div style={{
                                                fontSize: '11px',
                                                color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--text-sub)',
                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap', maxWidth: '220px'
                                            }}>
                                                {message.replyTo.content || (message.replyTo.media?.type ? `📎 ${message.replyTo.media.type}` : 'Media')}
                                            </div>
                                        </div>
                                    )}

                                    {/* Story reply / share */}
                                    {message.storyReply && (
                                        <div className="mb-2" style={{ maxWidth: message.storyReply.isShare ? '240px' : 'none', width: '100%' }}>
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
                                                    if (typeof window.onViewStory === 'function') { window.onViewStory(userId, storyId); return; }
                                                    try {
                                                        const res = await api.get('/api/story/feed');
                                                        const groups = Array.isArray(res.data) ? res.data : [];
                                                        const idx = groups.findIndex(g => g.user._id.toString() === userId.toString());
                                                        if (idx !== -1) {
                                                            setStoryModalGroups(groups); setStoryModalGroupIndex(idx);
                                                            setStoryModalInitialStoryId(storyId || null);
                                                            const mod = await import('./Stories');
                                                            setStoryViewerComp(() => mod.StoryViewer);
                                                            setShareStoryDialogComp(() => mod.ShareStoryDialog);
                                                            setStoryModalOpen(true); return;
                                                        }
                                                    } catch (err) { console.error('Failed to open story modal', err); }
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
                                                        <div className="absolute inset-0 bg-black/20">
                                                            {message.storyReply.mediaUrl ? (
                                                                <ProgressiveImage src={message.storyReply.mediaUrl} alt="Story Content" objectFit="cover" placeholderColor="#111" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-4xl">✨</div>
                                                            )}
                                                        </div>
                                                        {message.storyReply.authorName && (
                                                            <div className="absolute top-3 left-3 flex items-center gap-2 z-10 px-2 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
                                                                <img src={message.storyReply.authorProfilePicture || USER_DEFAULT_IMAGE} className="w-5 h-5 rounded-full object-cover border border-white/20" alt="" />
                                                                <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{message.storyReply.authorUsername || message.storyReply.authorName}</span>
                                                            </div>
                                                        )}
                                                        {message.storyReply.mediaType === 'video' && (
                                                            <div className="absolute bottom-3 right-3 z-10 p-2 bg-black/40 backdrop-blur-md rounded-full">
                                                                <i className="pi pi-play text-white text-[10px]"></i>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
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
                                                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, opacity: 0.9 }}>Replied to story</p>
                                                            <p style={{ margin: 0, fontSize: '10px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tap to view ✨</p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Shared post card */}
                                    {isSharedPost && (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setSelectedPostId(message.sharedPost?.postId || sharedLinkData.postId); setShowPostModal(true); }}
                                            className="cursor-pointer mb-2 overflow-hidden transition-all hover:brightness-110 active:scale-[0.98]"
                                            style={{ background: isOwn ? '#808bf5' : 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', width: '100%', maxWidth: '280px', color: '#fff' }}
                                        >
                                            {message.sharedPost ? (
                                                <>
                                                    <div className="flex items-center gap-2 p-3 border-b border-white/5">
                                                        <img src={message.sharedPost.authorProfilePicture || USER_DEFAULT_IMAGE} className="w-8 h-8 rounded-full object-cover border border-white/10" alt="" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[12px] font-bold truncate opacity-90">{message.sharedPost.authorName}</span>
                                                                <i className="pi pi-check-circle text-[#3897f0] text-[10px]"></i>
                                                            </div>
                                                            <p className="m-0 text-[10px] opacity-50 truncate">@{message.sharedPost.authorUsername}</p>
                                                        </div>
                                                    </div>
                                                    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1/1', maxHeight: '300px' }}>
                                                        {message.sharedPost.thumbnailUrl || message.sharedPost.mediaUrl ? (
                                                            <ProgressiveImage src={message.sharedPost.thumbnailUrl || message.sharedPost.mediaUrl} alt="Post Content" objectFit="cover" placeholderColor="rgba(0,0,0,0.4)" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-black/20 text-4xl">📦</div>
                                                        )}
                                                        {message.sharedPost.mediaType === 'video' && (
                                                            <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md rounded-lg p-1">
                                                                <i className="pi pi-video text-white text-[10px]"></i>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-3 bg-black/5">
                                                        <p className="m-0 text-[11px] line-clamp-2 leading-relaxed">
                                                            <span className="font-bold mr-1">{message.sharedPost.authorUsername}</span>
                                                            <span className="opacity-80">{message.sharedPost.caption}</span>
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-3 p-3">
                                                    <div className="w-12 h-12 rounded-lg bg-[#808bf5]/20 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                                                        {message.media?.url ? <ProgressiveImage src={message.media.url} alt="Post Preview" objectFit="cover" placeholderColor="rgba(128,139,245,0.1)" /> : '📦'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="m-0 text-[12px] font-bold opacity-90">Shared Post</p>
                                                        <p className="m-0 text-[10px] opacity-60 truncate">Tap to view post</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Shared profile */}
                                    {isSharedProfile && (
                                        <div onClick={(e) => { e.stopPropagation(); setProfileDetailId(sharedLinkData.profileId); }}
                                            className="cursor-pointer p-3 rounded-xl mb-2 flex items-center gap-4 transition-all"
                                            style={{ background: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--surface-3)', border: isOwn ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)' }}>
                                            <div className="w-10 h-10 rounded-lg bg-[#808bf5]/20 flex items-center justify-center text-lg flex-shrink-0">👤</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="m-0 text-[12px] font-bold opacity-90">Shared Profile</p>
                                                <p className="m-0 text-[10px] opacity-60 truncate">Tap to view profile</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shared story link */}
                                    {isSharedStoryLink && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (typeof window.onViewStory === 'function') { window.onViewStory(sharedLinkData.storyUserId, sharedLinkData.storyId); }
                                                else { window.location.href = `/story/${sharedLinkData.storyUserId}${sharedLinkData.storyId ? `/${sharedLinkData.storyId}` : ''}`; }
                                            }}
                                            style={{ cursor: 'pointer', padding: '0', background: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)', borderRadius: '12px', border: isOwn ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.1)', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}>
                                        </div>
                                    )}

                                    {/* Media */}
                                    {message.media?.url && (
                                        <div style={{ marginBottom: message.content ? '8px' : 0, position: 'relative' }}>
                                            {message.media.type === 'image' && (
                                                message.media.fileKey ? (
                                                    <DecryptedImage
                                                        url={message.media.url}
                                                        fileKey={message.media.fileKey}
                                                        iv={message.media.fileIv}
                                                        alt=""
                                                        style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '12px', display: 'block', opacity: message.isOptimistic ? 0.6 : 1 }}
                                                    />
                                                ) : (
                                                    <Image
                                                        src={message.media.url}
                                                        zoomSrc={message.media.url}
                                                        alt=""
                                                        preview
                                                        loading="lazy"
                                                        style={{ display: 'block', maxWidth: '100%' }}
                                                        imageStyle={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '12px', display: 'block', opacity: message.isOptimistic ? 0.6 : 1 }}
                                                    />
                                                )
                                            )}
                                            {message.media.type === 'audio' && (
                                                message.media.fileKey ? (
                                                    <DecryptedAudio
                                                        url={message.media.url}
                                                        fileKey={message.media.fileKey}
                                                        iv={message.media.fileIv}
                                                        duration={message.media.size}
                                                    />
                                                ) : (
                                                    <VoiceNotePlayer url={message.media.url} duration={message.media.size} />
                                                )
                                            )}
                                            {message.media.type === 'video' && <video src={message.media.url} poster={message.media.thumbnailUrl || getMediaThumbnail(message.media.url, 'video')} controls style={{ maxWidth: '200px', borderRadius: '12px', opacity: message.isOptimistic ? 0.6 : 1 }} />}
                                            {message.media.type === 'file' && (
                                                // eslint-disable-next-line jsx-a11y/anchor-is-valid
                                                <a href={message.isOptimistic ? '#' : message.media.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOwn ? '#fff' : '#808bf5', textDecoration: 'none', fontSize: '13px', opacity: message.isOptimistic ? 0.6 : 1 }}>
                                                    📎 {message.media.name || 'File'}
                                                </a>
                                            )}

                                            {message.isOptimistic && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                        <i className="pi pi-spin pi-spinner" style={{ color: '#fff', fontSize: '16px' }}></i>
                                                        <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>{message.uploadProgress || 0}%</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!hasSharedLinkCard && message.content && <p style={{ margin: 0 }}>{highlightText(message.content, searchQ)}</p>}
                                    {message.edited && <span style={{ fontSize: '10px', opacity: 0.5 }}> · edited</span>}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Time + read receipt ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                            {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {isOwn && !isDeleted && (
                            message.isOptimistic ? (
                                <i className="pi pi-clock" style={{ fontSize: '10px', color: '#9ca3af', opacity: 0.8 }}></i>
                            ) : message.uploadFailed ? (
                                <i className="pi pi-exclamation-circle" style={{ fontSize: '10px', color: '#ef4444' }}></i>
                            ) : (
                                <IconDoubleCheck status={checkmarkStatus} />
                            )
                        )}
                    </div>

                    {/* ── Reaction chips — in normal flow below bubble ── */}
                    {Object.keys(reactionGroups).length > 0 && !isDeleted && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                            {Object.entries(reactionGroups).map(([emoji, users]) => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(message._id, emoji)}
                                    style={{
                                        background: users.includes(loggeduser._id) ? 'rgba(128,139,245,0.12)' : 'var(--surface-2)',
                                        border: users.includes(loggeduser._id) ? '1px solid rgba(128,139,245,0.4)' : '1px solid var(--border-color)',
                                        borderRadius: '100px', padding: '3px 8px', cursor: 'pointer',
                                        fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px',
                                        fontWeight: 500, transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {emoji}
                                    {users.length > 1 && <span style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 600 }}>{users.length}</span>}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Pill toolbar on selection ── */}
                    {isSelected && !isDeleted && (
                        <div
                            style={{
                                position: 'absolute',
                                [isOwn ? 'right' : 'left']: 0,
                                top: '-44px',
                                display: 'flex', alignItems: 'center', gap: '2px',
                                background: 'var(--surface-1)',
                                borderRadius: '100px',
                                padding: '5px 10px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                border: '1px solid var(--border-color)',
                                zIndex: 100,
                            }}
                        >
                            {/* Emoji reaction opener */}
                            <div style={{ position: 'relative' }}>
                                <ToolbarBtn title="React" onClick={(e) => { e.stopPropagation(); setShowReactions(v => !v); }}>
                                    <IconSmile />
                                </ToolbarBtn>
                                {showReactions && (
                                    <ReactionPicker onSelect={emoji => { onReact(message._id, emoji); onSelect(null); }} onClose={() => setShowReactions(false)} />
                                )}
                            </div>

                            {/* Reply */}
                            <ToolbarBtn title="Reply" onClick={(e) => { e.stopPropagation(); onReply && onReply(message); onSelect(null); }}>
                                <IconReply />
                            </ToolbarBtn>

                            {/* Copy (for text messages) */}
                            {message.content && (
                                <ToolbarBtn title="Copy" onClick={handleCopy}>
                                    <IconCopy />
                                </ToolbarBtn>
                            )}

                            {isOwn && (
                                <>
                                    <div style={{ width: '0.5px', height: '18px', background: 'var(--border-color)', margin: '0 4px' }} />
                                    <ToolbarBtn title="Info" onClick={(e) => { e.stopPropagation(); onShowInfo && onShowInfo(message._id); onSelect(null); }}>
                                        <IconInfo />
                                    </ToolbarBtn>
                                    <ToolbarBtn title="Edit" onClick={(e) => { e.stopPropagation(); setEditing(true); onSelect(null); }}>
                                        <IconEdit />
                                    </ToolbarBtn>
                                    <ToolbarBtn title="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete(message._id); onSelect(null); }}>
                                        <IconTrash />
                                    </ToolbarBtn>
                                </>
                            )}
                        </div>
                    )}

                    {/* Dialogs */}
                    {showPostModal && selectedPostId && (
                        <Dialog showHeader={false} visible={showPostModal}
                            style={{ width: isDesktop ? '95vw' : '100vw', maxWidth: isDesktop ? '1200px' : 'none', height: isDesktop ? '90vh' : '100dvh' }}
                            onHide={() => setShowPostModal(false)}
                            contentStyle={{ padding: 0, borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', background: 'transparent' }}
                            baseZIndex={20000} dismissableMask blockScroll closable={false}
                        >
                            <div className="relative bg-[var(--surface-1)] h-full w-full" style={{ borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', border: isDesktop ? '1px solid var(--border-color)' : 'none' }}>
                                <button onClick={() => setShowPostModal(false)} className="absolute top-4 left-4 z-[20005] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg">
                                    <i className="pi pi-times text-sm"></i>
                                </button>
                                <React.Suspense fallback={<div className="p-20 text-center text-[var(--text-sub)] bg-[var(--surface-1)]"><div className="inline-block w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin mb-4"></div><p className="font-medium">Loading Post...</p></div>}>
                                    <PostDetail postId={selectedPostId} onHide={() => setShowPostModal(false)} />
                                </React.Suspense>
                            </div>
                        </Dialog>
                    )}
                    {storyModalOpen && StoryViewerComp && (
                        <Dialog header={null} aria-label="Story viewer" aria-modal="true" role="dialog" visible={storyModalOpen}
                            appendTo={document.body} baseZIndex={100000}
                            style={{ width: '100vw', maxWidth: '480px', height: '100vh', padding: 0 }}
                            onHide={() => setStoryModalOpen(false)} modal className="p-0 overflow-hidden story-viewer-dialog">
                            <div style={{ width: '100%', height: '100%' }}>
                                <StoryViewerComp groups={storyModalGroups} startGroupIndex={storyModalGroupIndex} initialStoryId={storyModalInitialStoryId}
                                    onClose={() => setStoryModalOpen(false)} loggeduser={loggeduser} onStoryDeleted={() => setStoryModalOpen(false)}
                                    onStoryLiked={(storyId, likes, poll) => {
                                        setStoryModalGroups(prev => prev.map(g => ({
                                            ...g,
                                            stories: g.stories.map(s => {
                                                if (s._id === storyId) {
                                                    const updated = { ...s };
                                                    if (likes !== undefined) updated.likes = likes;
                                                    if (poll !== undefined) updated.poll = poll;
                                                    return updated;
                                                }
                                                return s;
                                            })
                                        })));
                                    }} onOpenPostDetail={(postId) => { setSelectedPostId(postId); setShowPostModal(true); }}
                                    onShareStory={(s) => { setSharingStory(s); setShareOpen(true); }} />
                            </div>
                        </Dialog>
                    )}
                    {shareOpen && ShareStoryDialogComp && (
                        <ShareStoryDialogComp visible={shareOpen} onHide={() => setShareOpen(false)} story={sharingStory} loggeduser={loggeduser} />
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
const ChatPanel = ({
    participantId, lastMessage,
    isSearching = false, setIsSearching = () => { },
    searchQ = '', setSearchQ = () => { },
    searchIndex = 0, setSearchIndex = () => { },
    setSearchCount = () => { },
    onConversationIdFetched, refreshKey
}) => {
    const user = useAuthStore(s => s.user);
    const activeParticipant = useConversationStore(s => s.activeParticipant);
    const setTyping = useConversationStore(s => s.setTyping);
    const clearTyping = useConversationStore(s => s.clearTyping);
    const isTyping = useConversationStore(s => s.isTyping);
    const getTypingName = useConversationStore(s => s.getTypingName);
    const chatRef = useRef(null);
    const shouldAutoScroll = useRef(true);
    const fileInputRef = useRef(null);
    const typingTimer = useRef(null);
    const conversationIdRef = useRef(null);
    const lastFetchParamsRef = useRef({ conversationId: null, recipientId: null, refreshKey: null });

    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [replyTo, setReplyTo] = useState(null);
    const [privacyError, setPrivacyError] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);

    const [infoMessage, setInfoMessage] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [firstUnreadId, setFirstUnreadId] = useState(null);

    const handleShowMessageInfo = async (messageId) => {
        try {
            const res = await api.get(`/api/conversation/messages/${messageId}/info`);
            setInfoMessage(res.data);
            setIsInfoOpen(true);
        } catch {
            toast.error("Failed to load message info");
        }
    };

    useEffect(() => {
        if (conversationId && onConversationIdFetched) onConversationIdFetched(conversationId);
    }, [conversationId, onConversationIdFetched]);

    const searchMatches = useMemo(() => {
        if (!searchQ || !searchQ.trim()) return [];
        return messages.filter(m => m.content?.toLowerCase().includes(searchQ.toLowerCase())).map(m => m._id).reverse();
    }, [messages, searchQ]);

    useEffect(() => { setSearchCount(searchMatches.length); }, [searchMatches, setSearchCount]);

    useEffect(() => {
        if (isSearching && searchMatches.length > 0 && searchMatches[searchIndex]) {
            const el = document.getElementById(`msg-${searchMatches[searchIndex]}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchIndex, searchMatches, isSearching]);

    useEffect(() => {
        if (!isSearching || !searchQ || !searchQ.trim() || !conversationId) return;

        const localMatch = messages.some(m => m.content?.toLowerCase().includes(searchQ.toLowerCase()));
        if (localMatch || !hasMore) return;

        const delayDebounce = setTimeout(async () => {
            try {
                const res = await api.get(`/api/conversation/messages/search`, {
                    params: { conversationId, q: searchQ }
                });
                const searchHits = Array.isArray(res.data) ? res.data : [];
                if (searchHits.length > 0) {
                    const oldestMatch = searchHits[searchHits.length - 1];
                    const before = messages[0]?.createdAt;

                    setLoadingMore(true);
                    const messagesRes = await api.post(`/api/conversation/messages`, {
                        recipientId: participantId,
                        before,
                        targetDate: oldestMatch.createdAt,
                        limit: 30
                    });

                    const olderMessages = messagesRes.data.messages || [];
                    if (olderMessages.length > 0) {
                        setMessages(prev => {
                            const existingIds = new Set(prev.map(m => String(m._id)));
                            const uniqueOlder = olderMessages.filter(m => !existingIds.has(String(m._id)));
                            return [...uniqueOlder, ...prev];
                        });
                        setHasMore(messagesRes.data.hasMore || false);
                    }
                    setLoadingMore(false);
                }
            } catch (err) {
                console.error('Backend search load failed', err);
                setLoadingMore(false);
            }
        }, 600);

        return () => clearTimeout(delayDebounce);
    }, [isSearching, searchQ, conversationId, hasMore, participantId, messages]);

    const sendMessageMut = useSendMessage();
    const editMessageMut = useEditMessage();
    const deleteMessageMut = useDeleteMessage();
    const reactToMessageMut = useReactToMessage();
    const { mutate: markRead } = useMarkMessagesRead();
    const markReadRef = useRef(markRead);
    useEffect(() => { markReadRef.current = markRead; }, [markRead]);

    const activeIsGroup = activeParticipant?.isGroup;
    const activeConversationId = activeParticipant?.conversationId;

    const fetchMessages = useCallback(async () => {
        if (!user?._id || (!participantId && !activeIsGroup)) return;
        if (
            lastFetchParamsRef.current.conversationId === activeConversationId &&
            lastFetchParamsRef.current.recipientId === participantId &&
            lastFetchParamsRef.current.refreshKey === refreshKey
        ) {
            return;
        }
        setFirstUnreadId(null);
        lastFetchParamsRef.current = { conversationId: activeConversationId, recipientId: participantId, refreshKey };
        setLoading(true);
        try {
            const reqPayload = {
                limit: 30,
                ...(activeConversationId ? { conversationId: activeConversationId } : {}),
                ...(participantId ? { recipientId: participantId } : {})
            };
            const res = await api.post(`/api/conversation/messages`, reqPayload);
            const rawMessages = res.data.messages || [];
            const decryptMessage = useE2eeStore.getState().decryptMessage;
            const fetchedMessages = await Promise.all(rawMessages.map(msg => decryptMessage(msg, participantId)));
            const fetchedConversationId = res.data.conversation?._id || null;
            const fetchedHasMore = res.data.hasMore || false;
            setMessages(fetchedMessages);
            setConversationId(fetchedConversationId);
            setHasMore(fetchedHasMore);
            conversationIdRef.current = fetchedConversationId;
            const unreadMessages = fetchedMessages.filter(
                m =>
                    (
                        m.sender?._id ||
                        m.senderId ||
                        m.sender
                    ) !== user?._id &&
                    !m.isRead
            );
            const unreadIncomingIds =
                unreadMessages.map(m => m._id);

            if (unreadIncomingIds.length > 0) {
                setFirstUnreadId(prev => prev || unreadIncomingIds[0]);
            }

            if (
                fetchedConversationId &&
                unreadIncomingIds.length
            ) {

                // Mark messages read in DB
                // markRead({
                //     unreadMessageIds: unreadIncomingIds,
                //     lastMessage:
                //         unreadIncomingIds[
                //         unreadIncomingIds.length - 1
                //         ],
                //     conversationId: fetchedConversationId
                // });

                markReadRef.current({
                    unreadMessageIds: unreadIncomingIds, lastMessage: unreadIncomingIds[
                        unreadIncomingIds.length - 1
                    ], conversationId: fetchedConversationId
                });

                // Update local UI
                setMessages(prev =>
                    prev.map(m =>
                        unreadIncomingIds.includes(m._id)
                            ? { ...m, isRead: true }
                            : m
                    )
                );

                // Emit socket event back to sender (only for direct messages)
                if (!activeIsGroup) {
                    unreadMessages.forEach((msg) => {
                        socket.emit('readMessage', {
                            messageId: msg._id,
                            recipientId:
                                msg.sender?._id ||
                                msg.senderId ||
                                msg.sender
                        });
                    });
                }
            }

        } catch (err) {
            console.error('Failed to fetch messages', err);
            if (err.response?.status === 403) setPrivacyError(err.response.data.error || 'This account is private');
        }
        setLoading(false);
    }, [user?._id, participantId, activeIsGroup, activeConversationId, refreshKey]);

    const fetchMoreMessages = useCallback(async () => {
        if (loadingMore || !hasMore || !messages.length || (!participantId && !activeIsGroup)) return;
        setLoadingMore(true);
        const before = messages[0].createdAt;
        const oldScrollHeight = chatRef.current?.scrollHeight;
        try {
            const reqPayload = {
                before,
                limit: 30,
                ...(activeConversationId ? { conversationId: activeConversationId } : {}),
                ...(participantId ? { recipientId: participantId } : {})
            };
            const res = await api.post(`/api/conversation/messages`, reqPayload);
            const rawOlderMessages = res.data.messages || [];
            const decryptMessage = useE2eeStore.getState().decryptMessage;
            const olderMessages = await Promise.all(rawOlderMessages.map(msg => decryptMessage(msg, participantId)));
            if (olderMessages.length > 0) {
                setMessages(prev => [...olderMessages, ...prev]);
                setHasMore(res.data.hasMore || false);
                setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight - oldScrollHeight; }, 0);
            } else { setHasMore(false); }
        } catch (err) { console.error('Failed to fetch more messages', err); }
        finally { setLoadingMore(false); }
    }, [loadingMore, hasMore, messages, participantId, activeIsGroup, activeConversationId]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollTop === 0 && hasMore && !loadingMore) fetchMoreMessages();
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        shouldAutoScroll.current = distanceFromBottom < 200;
        setShowScrollBottom(distanceFromBottom > 400);
        if (selectedMessageId) setSelectedMessageId(null);
    };

    const scrollToBottom = () => { if (chatRef.current) chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); };

    useEffect(() => { fetchMessages(); }, [fetchMessages, refreshKey]);
    useEffect(() => { if (chatRef.current && !loading && !loadingMore) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [loading, conversationId, loadingMore]);
    useEffect(() => {
        if (!chatRef.current) return;
        if (shouldAutoScroll.current) {
            try { chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }
            catch { chatRef.current.scrollTop = chatRef.current.scrollHeight; }
        }
    }, [messages.length]);
    useEffect(() => {
        const onResize = () => { if (chatRef.current && shouldAutoScroll.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const handleReceive = async (message) => {
            const decryptMessage = useE2eeStore.getState().decryptMessage;
            const decryptedMsg = await decryptMessage(message, participantId);
            const isOwn = !decryptedMsg.isSystem && (decryptedMsg.senderId || decryptedMsg.sender?._id || decryptedMsg.sender) === user?._id;
            if (activeParticipant?.isGroup) {
                if (String(decryptedMsg.conversationId) !== String(conversationIdRef.current)) return;
            } else {
                if (String(decryptedMsg.senderId) !== String(participantId) && String(decryptedMsg.sender) !== String(participantId)) return;
            }
            if (isOwn) {
                // Already appended via handleSend. Just update potential missing DB metadata.
                setMessages(prev => prev.map(m => String(m._id) === String(decryptedMsg._id) ? decryptedMsg : m));
                return;
            }
            setMessages(prev => { if (prev.some(m => String(m._id) === String(decryptedMsg._id))) return prev; return [...prev, decryptedMsg]; });
            if (conversationIdRef.current) {
                markReadRef.current({ unreadMessageIds: [decryptedMsg._id], lastMessage: decryptedMsg._id, conversationId: conversationIdRef.current });
                if (!activeParticipant?.isGroup) {
                    socket.emit('readMessage', { messageId: decryptedMsg._id, recipientId: decryptedMsg.senderId || decryptedMsg.sender });
                }
            }
        };
        const handleSeen = ({ messageId }) => setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, isRead: true } : m));
        const handleMessagesReadSync = ({ conversationId: cid, messageIds, userId }) => {
            if (String(cid) !== String(conversationIdRef.current)) return;
            setMessages(prev => prev.map(m => {
                if (messageIds.includes(String(m._id))) {
                    const currentReadBy = m.readBy || [];
                    const alreadyRead = currentReadBy.some(id => String(id._id || id) === String(userId));
                    const updatedReadBy = alreadyRead ? currentReadBy : [...currentReadBy, userId];
                    return {
                        ...m,
                        isRead: true,
                        readBy: updatedReadBy
                    };
                }
                return m;
            }));
        };
        const handleEdited = ({ messageId, content }) => setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, content, edited: true } : m));
        const handleDeleted = ({ messageId }) => setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
        const handleReaction = ({ messageId, reactions }) => setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, reactions } : m));
        const handleTyping = ({ senderName, conversationId }) => {
            if (activeParticipant?.isGroup) {
                if (conversationId && String(conversationId) === String(conversationIdRef.current)) {
                    setTyping(conversationId, senderName);
                }
            } else {
                if (conversationIdRef.current) setTyping(conversationIdRef.current, senderName);
            }
        };
        const handleStopTyping = ({ conversationId }) => {
            if (activeParticipant?.isGroup) {
                if (conversationId && String(conversationId) === String(conversationIdRef.current)) {
                    clearTyping(conversationId);
                }
            } else {
                if (conversationIdRef.current) clearTyping(conversationIdRef.current);
            }
        };

        socket.on('receiveMessage', handleReceive);
        socket.on('seenMessage', handleSeen);
        socket.on('messagesReadSync', handleMessagesReadSync);
        socket.on('messageEdited', handleEdited);
        socket.on('messageDeleted', handleDeleted);
        socket.on('messageReaction', handleReaction);
        socket.on('userTyping', handleTyping);
        socket.on('userStoppedTyping', handleStopTyping);
        return () => {
            socket.off('receiveMessage', handleReceive);
            socket.off('seenMessage', handleSeen);
            socket.off('messagesReadSync', handleMessagesReadSync);
            socket.off('messageEdited', handleEdited);
            socket.off('messageDeleted', handleDeleted);
            socket.off('messageReaction', handleReaction);
            socket.off('userTyping', handleTyping);
            socket.off('userStoppedTyping', handleStopTyping);
        };
    }, [participantId, markRead, setTyping, clearTyping, activeParticipant, user?._id]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() && selectedFiles.length === 0) return;
        if (!conversationId && !participantId) return;
        setUploading(true);
        const currentText = text.trim();
        const currentFiles = [...selectedFiles];
        const currentPreviews = [...previews];
        const currentReplyTo = replyTo;
        setText(''); setSelectedFiles([]); setPreviews([]); setReplyTo(null);
        if (activeParticipant?.isGroup) {
            socket.emit('stopTyping', { conversationId: conversationIdRef.current || conversationId });
        } else {
            socket.emit('stopTyping', { recipientId: participantId });
        }
        try {
            if (currentFiles.length === 0) {
                const res = await sendMessageMut.mutateAsync({ conversationId, content: currentText, recipientId: activeParticipant?.isGroup ? undefined : participantId, replyTo: currentReplyTo?._id || null });
                const decryptMessage = useE2eeStore.getState().decryptMessage;
                const newMsg = await decryptMessage(res.data, participantId);
                setMessages(prev => [...prev, newMsg]);
                if (activeParticipant?.isGroup) {
                    socket.emit('sendMessage', { ...newMsg, conversationId, senderName: user.fullname, sender: user._id, senderId: user._id, socketId: socket.id });
                } else {
                    socket.emit('sendMessage', { ...newMsg, recipientId: participantId, senderName: user.fullname, sender: user._id, senderId: user._id, socketId: socket.id });
                }
                if (!conversationId && newMsg.conversationId) { setConversationId(newMsg.conversationId); conversationIdRef.current = newMsg.conversationId; }
                setUploading(false);
                return;
            }

            // Allow the user to continue chatting while files upload
            setUploading(false);

            // Process file uploads asynchronously
            (async () => {
                for (let i = 0; i < currentFiles.length; i++) {
                    const file = currentFiles[i];
                    const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
                    let mediaUrl, mediaType;

                    if (file.type.startsWith('image/')) {
                        mediaType = 'image';
                        mediaUrl = URL.createObjectURL(file);
                    } else if (file.type.startsWith('video/')) {
                        mediaType = 'video';
                        mediaUrl = URL.createObjectURL(file);
                    } else {
                        mediaType = 'file';
                        mediaUrl = 'DRIVE_FILE';
                    }

                    const optimisticMsg = {
                        _id: tempId,
                        conversationId: conversationIdRef.current || conversationId,
                        content: i === 0 ? currentText : '',
                        sender: user._id,
                        senderId: user._id,
                        senderName: user.fullname,
                        createdAt: new Date().toISOString(),
                        isOptimistic: true,
                        uploadProgress: 10,
                        media: {
                            type: mediaType,
                            url: mediaUrl,
                            name: file.name,
                            size: file.size
                        },
                        replyTo: i === 0 && currentReplyTo?._id ? currentReplyTo : null
                    };

                    setMessages(prev => [...prev, optimisticMsg]);

                    const onProgress = (percent) => {
                        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, uploadProgress: percent } : m));
                    };

                    try {
                        let thumbnailUrl = null;
                        let fileToUpload = file;
                        let fileKeyJWK = null;
                        let fileIv = null;

                        const e2eeState = useE2eeStore.getState();
                        const isE2eeActive = !!e2eeState.privateKey;
                        const isEncryptable = file.type.startsWith('image/') || file.type.startsWith('audio/');

                        if (isE2eeActive && isEncryptable) {
                            const fileKey = await generateSymmetricKey();
                            const { ciphertext, iv } = await encryptFile(file, fileKey);
                            fileToUpload = new Blob([ciphertext], { type: 'application/octet-stream' });
                            fileKeyJWK = await exportSymmetricKey(fileKey);
                            fileIv = iv;
                        }

                        if (file.type.startsWith('image/')) {
                            const existing = currentPreviews.find(p => p.file === file);
                            if (existing && existing.uploadedUrl && !isE2eeActive) {
                                mediaUrl = existing.uploadedUrl;
                            } else {
                                const r = await uploadMedia(fileToUpload, onProgress, { folder: 'chat' });
                                mediaUrl = typeof r === 'string' ? r : r?.url;
                            }
                        } else if (file.type.startsWith('video/')) {
                            const r = await uploadVideo(fileToUpload, onProgress, { folder: 'chat' });
                            mediaUrl = typeof r === 'string' ? r : r?.url;
                            thumbnailUrl = r?.thumbnailUrl;
                        } else {
                            if (file.type.startsWith('audio/') && isE2eeActive) {
                                const r = await uploadMedia(fileToUpload, onProgress, { folder: 'chat', resourceType: 'raw' });
                                mediaUrl = typeof r === 'string' ? r : r?.url;
                            } else {
                                const r = await uploadToDrive(fileToUpload, onProgress, { folder: 'chat' });
                                mediaUrl = r?.url;
                            }
                        }

                        const res = await sendMessageMut.mutateAsync({
                            conversationId: conversationIdRef.current || conversationId,
                            content: i === 0 ? currentText : '',
                            recipientId: activeParticipant?.isGroup ? undefined : participantId,
                            mediaUrl,
                            mediaType,
                            mediaName: file.name,
                            mediaSize: file.size,
                            thumbnailUrl,
                            replyTo: i === 0 && currentReplyTo?._id ? currentReplyTo._id : null,
                            fileKey: fileKeyJWK,
                            fileIv: fileIv
                        });

                        const decryptMessage = useE2eeStore.getState().decryptMessage;
                        const newMsg = await decryptMessage(res.data, participantId);
                        setMessages(prev => prev.map(m => m._id === tempId ? newMsg : m));
                        if (activeParticipant?.isGroup) {
                            socket.emit('sendMessage', { ...newMsg, conversationId: conversationIdRef.current || conversationId, senderName: user.fullname, sender: user._id, senderId: user._id, socketId: socket.id });
                        } else {
                            socket.emit('sendMessage', { ...newMsg, recipientId: participantId, senderName: user.fullname, sender: user._id, senderId: user._id, socketId: socket.id });
                        }
                        if (!conversationId && newMsg.conversationId) { setConversationId(newMsg.conversationId); conversationIdRef.current = newMsg.conversationId; }
                    } catch (err) {
                        console.error('Upload failed for file', file.name, err);
                        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, uploadFailed: true, isOptimistic: false } : m));
                    }
                }
            })();
        } catch (err) {
            console.error('Send failed:', err);
            toast.error('Failed to send messages');
            setUploading(false);
        }
    };

    const handleInputChange = (e) => {
        setText(e.target.value);
        if (activeParticipant?.isGroup) {
            socket.emit('typing', { conversationId: conversationIdRef.current || conversationId, senderName: user.fullname });
        } else {
            socket.emit('typing', { recipientId: participantId, senderName: user.fullname });
        }
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            if (activeParticipant?.isGroup) {
                socket.emit('stopTyping', { conversationId: conversationIdRef.current || conversationId });
            } else {
                socket.emit('stopTyping', { recipientId: participantId });
            }
        }, 1500);
    };

    const handleReact = async (messageId, emoji) => {
        try {
            const res = await reactToMessageMut.mutateAsync({ messageId, emoji, conversationId: conversationIdRef.current });
            const reactions = res.data.reactions;
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
            socket.emit('messageReaction', { messageId, conversationId: conversationIdRef.current, reactions, recipientId: participantId });
        } catch { toast.error('Reaction failed'); }
    };

    const handleEdit = async (messageId, content) => {
        setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, content, edited: true } : m));
        try {
            await editMessageMut.mutateAsync({ messageId, content, conversationId: conversationIdRef.current });
            socket.emit('messageEdited', { messageId, content, conversationId: conversationIdRef.current, recipientId: participantId });
        } catch {
            setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, content: m.content, edited: m.edited } : m));
            toast.error('Edit failed');
        }
    };

    const handleDelete = async (messageId) => {
        confirmDialog({
            message: 'Are you sure you want to delete this message?',
            header: 'Delete Message',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
                try {
                    await deleteMessageMut.mutateAsync({ messageId, conversationId: conversationIdRef.current });
                    socket.emit('messageDeleted', { messageId, conversationId: conversationIdRef.current, recipientId: participantId });
                } catch {
                    setMessages(prev => prev.map(m => String(m._id) === String(messageId) ? { ...m, deletedAt: null, content: m.content } : m));
                    toast.error('Delete failed');
                }
            }
        });
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setSelectedFiles(prev => [...prev, ...files]);
        files.forEach(file => {
            const id = Math.random().toString(36).substr(2, 9);
            if (file.type.startsWith('image/')) {
                // Show image preview and pre-upload to Cloudinary
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setPreviews(prev => [...prev, { id, url: ev.target.result, file, uploading: true, uploadedUrl: null, error: null, isFile: false }]);
                    uploadMedia(file, null, { folder: 'chat' })
                        .then(r => { const url = typeof r === 'string' ? r : r?.url; setPreviews(prev => prev.map(p => p.id === id ? { ...p, uploading: false, uploadedUrl: url } : p)); })
                        .catch(() => setPreviews(prev => prev.map(p => p.id === id ? { ...p, uploading: false, error: 'Upload failed' } : p)));
                };
                reader.readAsDataURL(file);
            } else {
                // Non-image files — show icon, upload to Drive on send
                const icon = getFileIcon(file.type, file.name);
                const sizeLabel = formatFileSize(file.size);
                setPreviews(prev => [...prev, { id, url: 'DRIVE_FILE', file, uploading: false, uploadedUrl: null, error: null, isFile: true, icon, sizeLabel }]);
            }
        });
        e.target.value = '';
    };

    const removeFile = (id) => {
        const p = previews.find(p => p.id === id);
        if (!p) return;
        setPreviews(prev => prev.filter(x => x.id !== id));
        setSelectedFiles(prev => prev.filter(f => f !== p.file));
    };

    const isTypingOther = conversationId && isTyping(conversationId);
    const typingName = conversationId ? getTypingName(conversationId) : null;



    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>

            {/* ── Messages list ── */}
            <div
                ref={chatRef} onScroll={handleScroll}
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedMessageId(null); }}
                style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
                {loading ? (
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: i % 2 === 0 ? 'flex-end' : 'flex-start', gap: '4px' }}>
                                <div style={{ width: i % 2 === 0 ? '60%' : '70%', height: '40px', background: 'var(--surface-2)', borderRadius: i % 2 === 0 ? '18px 18px 4px 18px' : '18px 18px 18px 4px', animation: 'pulse 1.5s infinite', opacity: 0.6 }} />
                                <div style={{ width: '40px', height: '10px', background: 'var(--surface-2)', borderRadius: '4px', animation: 'pulse 1.5s infinite', opacity: 0.4 }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {loadingMore && <div style={{ textAlign: 'center', padding: '10px', color: '#808bf5' }}><i className="pi pi-spin pi-spinner" style={{ fontSize: '14px' }}></i></div>}
                        {!hasMore && (
                            <div style={{ textAlign: 'center', padding: '10px 20px', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#808bf5', marginTop: '12px' }}>
                                    ✨ Reached the start of your chat with {activeParticipant?.fullname?.split(' ')[0] || 'this user'} ✨
                                </p>
                            </div>
                        )}
                        {messages.map((message, index) => {
                            const prevMessage = index > 0 ? messages[index - 1] : null;
                            const currentMsgDate = new Date(message.createdAt);
                            const prevMsgDate = prevMessage ? new Date(prevMessage.createdAt) : null;

                            let showDateDivider = false;
                            let dateLabel = '';

                            if (!prevMsgDate || currentMsgDate.toDateString() !== prevMsgDate.toDateString()) {
                                showDateDivider = true;
                                const today = new Date();
                                const yesterday = new Date(today);
                                yesterday.setDate(yesterday.getDate() - 1);

                                if (currentMsgDate.toDateString() === today.toDateString()) {
                                    dateLabel = 'Today';
                                } else if (currentMsgDate.toDateString() === yesterday.toDateString()) {
                                    dateLabel = 'Yesterday';
                                } else {
                                    dateLabel = currentMsgDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                                }
                            }

                            return (
                                <React.Fragment key={message._id}>
                                    {showDateDivider && (
                                        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 8px 0' }}>
                                            <div style={{ background: 'var(--surface-2)', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-sub)', border: '1px solid var(--border-color)' }}>
                                                {dateLabel}
                                            </div>
                                        </div>
                                    )}

                                    {firstUnreadId === message._id && (
                                        <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.5 }}></div>
                                            <div style={{ background: 'var(--surface-2)', padding: '4px 12px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Unread Messages
                                            </div>
                                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.5 }}></div>
                                        </div>
                                    )}

                                    {message.isSystem ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                                            <div style={{ background: 'var(--surface-2)', padding: '6px 14px', borderRadius: '16px', fontSize: '11px', color: 'var(--text-main)', textAlign: 'center', maxWidth: '80%', opacity: 0.8 }}>
                                                {message.content}
                                            </div>
                                        </div>
                                    ) : (
                                        <MessageBubble
                                            message={message}
                                            isOwn={message.sender?._id?.toString() === user?._id?.toString() || message.sender?.toString() === user?._id?.toString() || message.senderId === user?._id}
                                            isGroup={activeParticipant?.isGroup}
                                            conversationId={conversationId} loggeduser={user}
                                            onReact={handleReact} onEdit={handleEdit} onDelete={handleDelete}
                                            onShowInfo={handleShowMessageInfo}
                                            searchQ={searchQ}
                                            isSelected={selectedMessageId === message._id}
                                            onSelect={(msgId = message._id) => setSelectedMessageId(msgId)}
                                            onReply={msg => setReplyTo(msg)}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
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

            {/* ── Scroll-to-bottom FAB ── */}
            {showScrollBottom && (
                <button
                    onClick={scrollToBottom}
                    style={{
                        position: 'absolute', bottom: 80, right: 16,
                        width: 40, height: 40, borderRadius: '50%',
                        background: '#808bf5', color: '#fff', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 4px 15px rgba(128,139,245,0.4)',
                        zIndex: 50, transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    title="Scroll to bottom"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
            )}

            {/* ── Composer area ── */}
            <div style={{ padding: '8px 12px 10px', background: 'var(--surface-1)', borderTop: '1px solid var(--border-color)', zIndex: 10, boxSizing: 'border-box' }}>

                {privacyError ? (
                    <div style={{ padding: '16px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: '12px', color: 'var(--text-sub)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <i className="pi pi-lock" style={{ fontSize: '20px', opacity: 0.5 }}></i>
                        <p style={{ margin: 0, fontWeight: 600 }}>{privacyError}</p>
                        <p style={{ margin: 0, fontSize: '11px' }}>You must follow this user to send messages.</p>
                    </div>
                ) : (
                    <div style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: replyTo ? '16px 16px 24px 24px' : '24px',
                        overflow: 'hidden',
                        background: 'var(--surface-2)',
                        transition: 'border-radius 0.2s',
                    }}>
                        {/* ── Reply preview fused to top of composer ── */}
                        {replyTo && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 14px 8px',
                                borderBottom: '1px solid var(--border-color)',
                                background: 'var(--surface-2)',
                            }}>
                                <div style={{ width: 3, alignSelf: 'stretch', background: '#808bf5', borderRadius: '2px', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#808bf5', marginBottom: '2px' }}>
                                        Replying to {replyTo.sender?.fullname || 'User'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {replyTo.content || (replyTo.media?.type ? `📎 ${replyTo.media.type}` : 'Media')}
                                    </div>
                                </div>
                                <button
                                    type="button" onClick={() => setReplyTo(null)}
                                    style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-sub)', flexShrink: 0, padding: 0 }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border-color)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-3)'}
                                >
                                    <IconX size={10} />
                                </button>
                            </div>
                        )}

                        {/* ── File previews ── */}
                        {previews.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 12px 4px', scrollbarWidth: 'none' }}>
                                {previews.map((p) => (
                                    <div key={p.id} style={{ minWidth: '72px', height: '72px', background: 'var(--surface-3)', borderRadius: '10px', position: 'relative', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {p.isFile ? (
                                            // Non-image file — show icon + filename
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px' }}>
                                                <span style={{ fontSize: '22px' }}>{p.icon || '📎'}</span>
                                                <span style={{ fontSize: '8px', color: 'var(--text-sub)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.2, maxWidth: '60px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.file.name}</span>
                                                {p.sizeLabel && <span style={{ fontSize: '7px', color: 'var(--text-sub)', opacity: 0.7 }}>{p.sizeLabel}</span>}
                                            </div>
                                        ) : (
                                            <img src={p.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: p.uploading ? 0.5 : 1 }} />
                                        )}
                                        <button type="button" onClick={() => removeFile(p.id)}
                                            style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 5 }}>
                                            <IconX size={9} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Input row ── */}
                        <form onSubmit={handleSend} style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '6px 6px 6px 12px' }}>
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                style={{ background: 'none', border: 'none', cursor: uploading ? 'default' : 'pointer', color: uploading ? '#9ca3af' : 'var(--text-sub)', padding: '6px', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '50%', transition: 'color 0.15s' }}
                                onMouseEnter={e => { if (!uploading) e.currentTarget.style.color = '#808bf5'; }}
                                onMouseLeave={e => e.currentTarget.style.color = uploading ? '#9ca3af' : 'var(--text-sub)'}
                            >
                                {uploading
                                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                                    : <IconPaperclip />
                                }
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="*/*" onChange={handleFileSelect} style={{ display: 'none' }} />

                            <input
                                type="text" value={text} onChange={handleInputChange}
                                placeholder="Type your message..."
                                style={{ flex: 1, padding: '8px 4px', border: 'none', fontSize: '14px', outline: 'none', background: 'transparent', color: 'var(--text-main)' }}
                                onPaste={e => {
                                    if (e.clipboardData?.items) {
                                        for (let i = 0; i < e.clipboardData.items.length; i++) {
                                            const item = e.clipboardData.items[i];
                                            if (item.kind === 'file' && item.type.startsWith('image/')) {
                                                const file = item.getAsFile();
                                                if (file) {
                                                    setSelectedFiles(prev => [...prev, file]);
                                                    const id = Math.random().toString(36).substr(2, 9);
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        setPreviews(prev => [...prev, { id, url: ev.target.result, file, uploading: true, uploadedUrl: null, error: null }]);
                                                        uploadMedia(file, null, { folder: 'chat' }).then(r => { const url = typeof r === 'string' ? r : r?.url; setPreviews(prev => prev.map(p => p.id === id ? { ...p, uploading: false, uploadedUrl: url } : p)); }).catch(() => setPreviews(prev => prev.map(p => p.id === id ? { ...p, uploading: false, error: 'Upload failed' } : p)));
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                            <button
                                type="submit"
                                disabled={(!text.trim() && selectedFiles.length === 0) || uploading}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: (text.trim() || selectedFiles.length > 0) ? '#808bf5' : 'var(--surface-3)',
                                    color: (text.trim() || selectedFiles.length > 0) ? '#fff' : 'var(--text-sub)',
                                    cursor: (text.trim() || selectedFiles.length > 0) ? 'pointer' : 'default',
                                    transition: 'background 0.2s, transform 0.15s',
                                }}
                                onMouseEnter={e => { if (text.trim() || selectedFiles.length > 0) e.currentTarget.style.transform = 'scale(1.08)'; }}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <IconSend />
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Seen Info Dialog */}
            <Dialog
                header={"Message Info"}
                visible={isInfoOpen}
                onHide={() => { setIsInfoOpen(false); setInfoMessage(null); }}
                style={{ width: '95vw', maxWidth: '420px', borderRadius: '24px' }}
                className="dark:bg-[var(--surface-1)] seen-info-dialog"
                closable={true}
            >
                {infoMessage ? (
                    <div className="py-2 flex flex-col gap-4">
                        {/* Message Preview */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100/50 dark:border-gray-800/10">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-black block mb-1">Message</span>
                            <p className="m-0 text-sm font-medium text-[var(--text-main)] break-all">{infoMessage.message?.content || (infoMessage.message?.media?.type ? `📎 ${infoMessage.message.media.type}` : 'Media')}</p>
                            <span className="text-[10px] text-gray-400 block mt-2">Sent at {new Date(infoMessage.message?.createdAt).toLocaleString()}</span>
                        </div>

                        {/* Seen List */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Read By ({infoMessage.message?.readBy?.length || 0})</span>
                            <div className="max-h-48 overflow-y-auto flex flex-col gap-2 p-1 custom-scrollbar">
                                {infoMessage.message?.readBy?.length > 0 ? (
                                    infoMessage.message.readBy.map(u => (
                                        <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50/20 dark:bg-gray-900/10 border border-gray-100/50 dark:border-gray-800/10">
                                            <img src={u.profile_picture || USER_DEFAULT_IMAGE} className="w-8 h-8 rounded-full object-cover" alt="" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-xs truncate text-[var(--text-main)]">{u.fullname}</span>
                                                <span className="text-[10px] text-gray-400">@{u.username}</span>
                                            </div>
                                            <span className="ml-auto inline-flex items-center text-indigo-500 font-bold text-xs gap-0.5">
                                                <i className="pi pi-check-circle" /> Read
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-gray-400 text-xs italic">No one has read this message yet.</div>
                                )}
                            </div>
                        </div>

                        {/* Group Info Delivered To List (only for groups) */}
                        {infoMessage.conversation?.isGroup && (
                            <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                                <span className="text-xs font-black uppercase tracking-wider text-gray-400">Delivered To</span>
                                <div className="max-h-48 overflow-y-auto flex flex-col gap-2 p-1 custom-scrollbar">
                                    {infoMessage.conversation.participants
                                        ?.filter(p => p.userId !== infoMessage.message.sender && !infoMessage.message.readBy?.some(u => u._id === p.userId))
                                        .map(p => (
                                            <div key={p.userId} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50/20 dark:bg-gray-900/10 border border-gray-100/50 dark:border-gray-800/10">
                                                <img src={p.profilePicture || USER_DEFAULT_IMAGE} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-xs truncate text-[var(--text-main)]">{p.fullname}</span>
                                                </div>
                                                <span className="ml-auto inline-flex items-center text-gray-400 font-medium text-[11px] gap-0.5">
                                                    <i className="pi pi-check" /> Delivered
                                                </span>
                                            </div>
                                        ))
                                    }
                                    {infoMessage.conversation.participants?.filter(p => p.userId !== infoMessage.message.sender && !infoMessage.message.readBy?.some(u => u._id === p.userId)).length === 0 && (
                                        <div className="text-center py-4 text-green-500 text-xs font-bold">✓ Read by all participants!</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8"><i className="pi pi-spin pi-spinner text-lg text-indigo-500" /></div>
                )}
            </Dialog>

            <style>{`
                @keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }
                @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
            `}</style>
        </div>
    );
};

export default ChatPanel;