import { useEffect, useRef } from "react";
import { useInView } from 'react-intersection-observer';
import SkeletonPost from './ui/SkeletonPost';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { Dialog } from 'primereact/dialog';
import { useState } from 'react';
import toast from 'react-hot-toast';
import formatDate from '../../utils/formatDate';

import useAuthStore from '../../store/zustand/useAuthStore';
import {
    useFeed, useMoodFeed,
    useLikePost, useSavePost, useDeletePost, useUpdatePost,
} from '../../hooks/queries/usePostQueries';
import { useAcceptCollaboration, useDeclineCollaboration, useReportPost } from '../../hooks/queries/usePostOperationsQueries';
import { useConversations, useSendMessage } from '../../hooks/queries/useConversationQueries';
import usePostStore from '../../store/zustand/usePostStore';

const MOOD_EMOJI = { happy: '😊', sad: '😢', excited: '🤩', angry: '😠', calm: '😌', romantic: '❤️', funny: '😂', inspirational: '💪', nostalgic: '🥹', neutral: '😐' };

// ─── HEART BURST ──────────────────────────────────────────────────────────────
const HeartBurst = ({ visible }) => visible ? (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none', animation: 'heartBurst 0.8s ease forwards' }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
    </div>
) : null;

// ─── IMAGE CAROUSEL ───────────────────────────────────────────────────────────
const ImageCarousel = ({ images, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);
    if (!images?.length) return null;
    if (images.length === 1) return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ background: '#000' }}>
            <img src={images[0]} alt="Post" style={{ width: '100%', aspectRatio: '1/1', maxHeight: '620px', objectFit: 'contain', display: 'block' }} />
        </div>
    );
    return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ position: 'relative' }}>
            <img src={images[current]} alt={`${current + 1}`} style={{ width: '100%', aspectRatio: '1/1', maxHeight: '620px', objectFit: 'cover', display: 'block', background: '#000' }} />
            {current > 0 && <button onClick={e => { e.stopPropagation(); setCurrent(c => c - 1) }} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
            {current < images.length - 1 && <button onClick={e => { e.stopPropagation(); setCurrent(c => c + 1) }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 600 }}>{current + 1}/{images.length}</div>
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', zIndex: 2 }}>
                {images.map((_, i) => <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i) }} style={{ width: i === current ? '16px' : '6px', height: '6px', borderRadius: '3px', border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />)}
            </div>
        </div>
    );
};

// ─── POST MENU ────────────────────────────────────────────────────────────────
const PostMenu = ({ post, user, onEdit, onDelete, onSave, isSaved, onReport, isSaving }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const isOwner = post.user._id === user?._id || post.user._id?.toString() === user?._id;
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)} className="bg-transparent border-0 cursor-pointer p-2 rounded-full text-gray-500 hover:bg-gray-100 transition">⋯</button>
            {open && (
                <div className="absolute right-0 top-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden mt-1" style={{ minWidth: '170px' }}>
                    <button onClick={() => { if (!isSaving) onSave(); setOpen(false) }} disabled={isSaving} style={{ opacity: isSaving ? 0.5 : 1 }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-gray-50">{isSaved ? '🔖 Unsave' : '🔖 Save post'}</button>
                    {!isOwner && <button onClick={() => { onReport(); setOpen(false) }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-red-50 text-red-400">🚩 Report post</button>}
                    {isOwner && <>
                        <button onClick={() => { onEdit(); setOpen(false) }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-gray-50">✏️ Edit post</button>
                        <button onClick={() => { onDelete(); setOpen(false) }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm text-red-500 hover:bg-red-50">🗑️ Delete post</button>
                    </>}
                </div>
            )}
        </div>
    );
};

// ─── SHARE DIALOG ─────────────────────────────────────────────────────────────
const ShareDialog = ({ post, visible, onHide, user }) => {
    const [sending, setSending] = useState(null);
    const postUrl = `${window.location.origin}/post/${post?._id}`;
    const { data: conversations = [] } = useConversations(visible ? user?._id : null);
    const sendMessageMut = useSendMessage();

    const copyLink = () => { navigator.clipboard.writeText(postUrl); toast.success('Link copied!'); };
    const shareToConv = async (conv) => {
        setSending(conv._id);
        const other = conv.participants.find(p => p.userId !== user._id);
        try {
            await sendMessageMut.mutateAsync({
                conversationId: conv._id,
                content: `🔗 Shared a post: ${postUrl}`,
                recipientId: other?.userId,
            });
            toast.success(`Shared to ${other?.fullname || 'conversation'}`);
        } catch { toast.error('Failed to share'); }
        setSending(null);
    };
    return (
        <Dialog header="Share post" visible={visible} style={{ width: '320px' }} onHide={onHide}>
            <div className="flex flex-col gap-3">
                <button onClick={copyLink} className="flex items-center gap-3 p-3 bg-gray-100 border-0 rounded-xl cursor-pointer font-semibold text-sm">🔗 Copy link</button>
                {conversations.map(conv => {
                    const other = conv.participants.find(p => p.userId !== user._id);
                    return (
                        <button key={conv._id} onClick={() => shareToConv(conv)} disabled={sending === conv._id} className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-left">
                            <img src={other?.profilePicture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <span className="text-sm font-medium">{other?.fullname || 'Unknown'}</span>
                            {sending === conv._id && <span className="ml-auto text-xs text-indigo-500">Sending...</span>}
                        </button>
                    );
                })}
            </div>
        </Dialog>
    );
};

// ─── TIME LOCK OVERLAY ────────────────────────────────────────────────────────
const TimeLockOverlay = ({ unlocksAt }) => {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const update = () => {
            const diff = new Date(unlocksAt) - Date.now();
            if (diff <= 0) { setRemaining('Unlocking...'); return; }
            const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${h}h ${m}m ${s}s`);
        };
        update(); const t = setInterval(update, 1000); return () => clearInterval(t);
    }, [unlocksAt]);
    return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
            <span style={{ fontSize: '40px' }}>🔒</span>
            <p style={{ color: '#fff', fontWeight: 700, margin: '8px 0 4px', fontSize: '16px' }}>Time-Locked Post</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: 0 }}>Unlocks in {remaining}</p>
        </div>
    );
};

// ─── COLLAB INVITE BANNER ─────────────────────────────────────────────────────
const CollabInviteBanner = ({ post, user }) => {
    const collab = post.collaborators?.find(c => c.userId?.toString() === user?._id?.toString() && c.status === 'pending');
    const [contribution, setContribution] = useState('');
    const [done, setDone] = useState(false);
    const acceptMut = useAcceptCollaboration();
    const declineMut = useDeclineCollaboration();

    if (!collab || done) return null;
    const respond = async (accepted) => {
        try {
            if (accepted) {
                await acceptMut.mutateAsync({ postId: post._id, contribution });
            } else {
                await declineMut.mutateAsync({ postId: post._id });
            }
            toast.success(accepted ? '🤝 Accepted!' : 'Declined');
            setDone(true);
        } catch { toast.error('Failed'); }
    };
    return (
        <div style={{ background: '#ede9fe', borderRadius: '8px', padding: '10px 12px', margin: '8px 16px 0' }}>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>🤝 You've been invited to collaborate!</p>
            <input type="text" placeholder="Add your contribution..." value={contribution} onChange={e => setContribution(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #c4b5fd', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => respond(true)} disabled={acceptMut.isPending} style={{ flex: 1, padding: '5px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: acceptMut.isPending ? 0.6 : 1 }}>Accept</button>
                <button onClick={() => respond(false)} disabled={declineMut.isPending} style={{ flex: 1, padding: '5px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: declineMut.isPending ? 0.6 : 1 }}>Decline</button>
            </div>
        </div>
    );
};

// ─── FEED ─────────────────────────────────────────────────────────────────────
const Feed = ({ activeMood = null }) => {
    // ✅ Zustand
    const user = useAuthStore(s => s.user);
    const followUser = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const socketPosts = usePostStore(s => s.socketPosts) || [];
    const isSaved = usePostStore(s => s.isSaved);
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);

    // ✅ TanStack Query
    const feedQuery = useFeed(user?._id);
    const moodQuery = useMoodFeed(activeMood, user?._id);
    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const reportMutation = useReportPost();
    const setPostDetailId = usePostStore(s => s.setPostDetailId);

    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [sharePost, setSharePost] = useState(null);
    const [savingPostIds, setSavingPostIds] = useState(new Set());
    const lastTap = useRef({});

    // Infinite scroll sentinel
    const { ref: loaderRef, inView } = useInView({ threshold: 0.1 });
    useEffect(() => {
        if (inView && !activeMood && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
        }
    }, [inView, activeMood, feedQuery]);

    // Merge pages + socket posts
    const serverPosts = feedQuery.data?.pages?.flatMap(p => p.posts) || [];
    const displayPosts = activeMood
        ? (moodQuery.data || [])
        : [...socketPosts.filter(sp => !serverPosts.some(p => p._id === sp._id)), ...serverPosts];

    const getImages = post => post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    const handleLikeToggle = (post) => {
        // ✅ Prevent clicking while request is in progress
        if (likeMutation.isPending) return;

        const liked = post.likes?.includes(user?._id) || optimisticLikes[post._id]?.has(user?._id);
        likeMutation.mutate({ postId: post._id, isLiked: liked });
    };

    const handleImageDoubleClick = post => {
        const liked = post.likes?.includes(user?._id);
        if (!liked) likeMutation.mutate({ postId: post._id, isLiked: false });
        setHeartVisible(p => ({ ...p, [post._id]: true }));
        setTimeout(() => setHeartVisible(p => ({ ...p, [post._id]: false })), 800);
    };

    const handleImageTap = post => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] || 0) < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    };

    const handleSave = post => {
        // Disable button immediately
        setSavingPostIds(prev => new Set([...prev, post._id]));

        // Get current saved state for rollback
        const wasSaved = isSaved(post._id);

        // Optimistically update UI
        toggleSaved(post._id, !wasSaved);

        // Send request
        saveMutation.mutate({ postId: post._id }, {
            onSuccess: (res) => {
                // Silent update
            },
            onError: (error) => {
                // Rollback on error
                toggleSaved(post._id, wasSaved);
                toast.error('Failed to save');
            },
            onSettled: () => {
                // Re-enable button
                setSavingPostIds(prev => {
                    const next = new Set(prev);
                    next.delete(post._id);
                    return next;
                });
            },
        });
    };

    const handleDelete = post => {
        if (!window.confirm('Delete this post?')) return;
        deleteMutation.mutate({ postId: post._id }, {
            onSuccess: () => toast.success('Post deleted'),
        });
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: editingPost._id, caption: editCaption }, {
            onSuccess: () => { toast.success('Updated'); setEditingPost(null); }
        });
    };

    const handleFollow = post => {
        const isFollowing = user?.following?.some(f => f?.toString() === post.user._id?.toString());
        if (isFollowing) unfollowUser(post.user._id);
        else followUser(post.user._id);
    };

    const handleReport = async post => {
        const reasons = ['spam', 'harassment', 'hate_speech', 'misinformation', 'nudity', 'violence', 'other'];
        const choice = window.prompt(`Report reason:\n${reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nEnter number:`);
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (idx < 0 || idx >= reasons.length) { toast.error('Invalid choice'); return; }
        try {
            await reportMutation.mutateAsync({ postId: post._id, reason: reasons[idx] });
            toast.success('Report submitted. Thank you!');
        } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const renderCaption = (caption = '') => caption.split(/(\s+)/).map((token, i) => {
        if (/^#[\w]+$/.test(token) || /^@[\w.]+$/.test(token))
            return <span key={i} className="text-indigo-500 font-medium">{token}</span>;
        return <span key={i}>{token}</span>;
    });

    const isLoading = activeMood ? moodQuery.isLoading : (feedQuery.isLoading && displayPosts.length === 0);

    return (
        <>
            <style>{`
                @keyframes heartBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
                .music-tag{animation:musicPulse 2s ease-in-out infinite}
                @keyframes musicPulse{0%,100%{opacity:1}50%{opacity:0.6}}
            `}</style>

            <div>
                {isLoading ? (
                    <div className="mt-3 flex flex-col gap-3">{[1, 2, 3].map(i => <SkeletonPost key={i} />)}</div>
                ) : (
                    <div className="mt-3 flex flex-col gap-4">
                        {displayPosts.length > 0 ? displayPosts.map((post, index) => {
                            const images = getImages(post);
                            const isOwn = !post.isAnonymous && (post.user._id === user?._id || post.user._id?.toString() === user?._id);
                            const isFollowing = user?.following?.some(f => f?.toString() === post.user._id?.toString());
                            const postIsSaved = isSaved(post._id);
                            const locked = post.unlocksAt && new Date(post.unlocksAt) > Date.now() && !isOwn;
                            const expiryRemaining = post.expiresAt ? Math.max(0, new Date(post.expiresAt) - Date.now()) : null;
                            const likes = optimisticLikes[post._id] ? [...(optimisticLikes[post._id])] : (post.likes || []);

                            return (
                                <article key={post._id || index} className="relative overflow-hidden w-full rounded-2xl shadow-sm flex flex-col border bg-white">
                                    <CollabInviteBanner post={post} user={user} />

                                    {/* Header */}
                                    <div className="flex items-start justify-between px-4 py-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={post.user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h6 className="m-0 font-semibold text-sm leading-tight">{post.user.fullname}</h6>
                                                    {post.isAnonymous && <span style={{ fontSize: '10px', background: '#ede9fe', color: '#6366f1', borderRadius: '10px', padding: '1px 6px' }}>🎭 Anonymous</span>}
                                                    {post.isCollaborative && post.collaborators?.some(c => c.status === 'accepted') && <span style={{ fontSize: '10px', background: '#d1fae5', color: '#059669', borderRadius: '10px', padding: '1px 6px' }}>🤝 Collab</span>}
                                                    {!isOwn && (
                                                        <button onClick={() => handleFollow(post)} className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer font-semibold transition ${isFollowing ? 'border-gray-200 bg-transparent text-gray-500' : 'border-indigo-500 bg-[#808bf5] text-white'}`}>
                                                            {isFollowing ? 'Following' : 'Follow'}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {post.location?.name && <span className="text-xs text-gray-500">{post.location.name}</span>}
                                                    {post.mood && <span className="text-xs text-gray-500">{MOOD_EMOJI[post.mood]} {post.mood}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                                            {post.music?.title && <div className="music-tag flex items-center gap-1 bg-pink-50 rounded-full px-2 py-1 text-[11px] text-pink-500 font-medium max-w-[130px] truncate">🎵 {post.music.title}</div>}
                                            {expiryRemaining !== null && expiryRemaining < 3600000 && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', borderRadius: '10px', padding: '1px 6px' }}>⏳ Expiring soon</span>}
                                            <PostMenu post={post} user={user} isSaved={postIsSaved}
                                                onSave={() => handleSave(post)}
                                                onEdit={() => { setEditingPost(post); setEditCaption(post.caption) }}
                                                onDelete={() => handleDelete(post)}
                                                onReport={() => handleReport(post)}
                                                isSaving={savingPostIds.has(post._id)}
                                            />
                                        </div>
                                    </div>

                                    {/* Images */}
                                    {images.length > 0 && (
                                        <div className="relative border-y border-gray-100">
                                            <ImageCarousel images={images} onDoubleClick={() => !locked && handleImageDoubleClick(post)} onTouchEnd={() => !locked && handleImageTap(post)} />
                                            {locked && <TimeLockOverlay unlocksAt={post.unlocksAt} />}
                                            <HeartBurst visible={!!heartVisible[post._id]} />
                                        </div>
                                    )}

                                    {locked && images.length === 0 && (
                                        <div style={{ background: '#f3f4f6', margin: '0 16px', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '32px', margin: 0 }}>🔒</p>
                                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>This post is time-locked</p>
                                        </div>
                                    )}

                                    {/* Collaborators */}
                                    {post.isCollaborative && post.collaborators?.filter(c => c.status === 'accepted' && c.contribution).length > 0 && (
                                        <div style={{ margin: '0 16px', background: '#f0fdf4', borderRadius: '8px', padding: '8px 12px' }}>
                                            <p style={{ fontSize: '11px', color: '#059669', fontWeight: 600, margin: '0 0 4px' }}>🤝 Collaborators added:</p>
                                            {post.collaborators.filter(c => c.status === 'accepted' && c.contribution).map((c, i) => (
                                                <p key={i} style={{ fontSize: '12px', margin: '2px 0', color: '#374151' }}><strong>{c.fullname}:</strong> {c.contribution}</p>
                                            ))}
                                        </div>
                                    )}

                                    {/* Voice note */}
                                    {post.voiceNote?.url && (
                                        <div style={{ margin: '0 16px' }}>
                                            <audio src={post.voiceNote.url} controls style={{ width: '100%', height: '36px' }} />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {!locked && (
                                        <div className="bg-white text-gray-900 w-full px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-4">
                                                    <div onClick={(e) => { e.stopPropagation(); handleLikeToggle(post); }} className="flex items-center gap-2 cursor-pointer">
                                                        <Like isliked={likes.includes(user?._id) || likes.some(id => id?.toString() === user?._id)} loading={likeMutation.isPending} />
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); setVisiblePostId(p => p === post._id ? null : post._id); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900">
                                                        <i className="pi pi-comment" style={{ fontSize: '1.2rem' }}></i>
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setSharePost(post); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900">
                                                        <i className="pi pi-send" style={{ fontSize: '1.15rem' }}></i>
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setPostDetailId(post._id); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900 ml-auto" style={{ marginRight: '4px' }}>
                                                        <i className="pi pi-external-link" style={{ fontSize: '1rem' }}></i>
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleSave(post); }} disabled={savingPostIds.has(post._id)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0" style={{ opacity: savingPostIds.has(post._id) ? 0.5 : 1, pointerEvents: savingPostIds.has(post._id) ? 'none' : 'auto' }}>
                                                        <i className={`pi ${postIsSaved ? 'pi-bookmark-fill' : 'pi-bookmark'}`} style={{ fontSize: '1.1rem', color: postIsSaved ? '#808bf5' : 'currentColor' }}></i>
                                                    </button>
                                                </div>
                                                <p className="m-0 mt-2 text-sm font-semibold">{likes.length.toLocaleString()} likes</p>
                                                <p className="m-0 mt-1 text-sm leading-relaxed"><span className="font-semibold mr-1">{post.user.username || post.user.fullname}</span>{renderCaption(post.caption || '')}</p>
                                                <p className="m-0 mt-1 text-xs text-gray-500 cursor-pointer" onClick={() => setVisiblePostId(p => p === post._id ? null : post._id)}>View all {post.comments?.length || 0} comments</p>
                                                <p className="m-0 mt-2 text-[10px] text-gray-400 uppercase tracking-wide">{formatDate(post.updatedAt)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {visiblePostId === post._id && <Comment postId={post._id} setVisible={() => setVisiblePostId(null)} />}
                                </article>
                            );
                        }) : (
                            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                                <p style={{ fontSize: '36px', margin: 0 }}>{activeMood ? '😔' : '📭'}</p>
                                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '8px 0 0' }}>{activeMood ? `No ${activeMood} posts found` : 'No posts to display.'}</p>
                            </div>
                        )}

                        {/* Sentinel */}
                        <div ref={loaderRef} className="h-10 flex items-center justify-center">
                            {feedQuery.isFetchingNextPage && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                            {!activeMood && !feedQuery.hasNextPage && displayPosts.length > 0 && <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>}
                        </div>
                    </div>
                )}

                {sharePost && <ShareDialog post={sharePost} visible={!!sharePost} onHide={() => setSharePost(null)} user={user} />}

                <Dialog header="Edit Post" visible={!!editingPost} style={{ width: '340px' }} onHide={() => setEditingPost(null)}>
                    {editingPost && (
                        <div className="flex flex-col gap-3">
                            <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-y" />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingPost(null)} className="px-4 py-1.5 border border-gray-200 rounded-lg bg-transparent cursor-pointer text-sm">Cancel</button>
                                <button onClick={handleEditSubmit} className="px-4 py-1.5 bg-[#808bf5] text-white border-0 rounded-lg cursor-pointer text-sm font-semibold">Save</button>
                            </div>
                        </div>
                    )}
                </Dialog>
            </div>
        </>
    );
};

export default Feed;