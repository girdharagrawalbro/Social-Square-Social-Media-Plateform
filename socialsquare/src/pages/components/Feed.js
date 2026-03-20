import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSelector, useDispatch } from 'react-redux';
import SkeletonPost from './ui/SkeletonPost';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';
import { fetchPosts, fetchComments, unlikepost, likepost, deletePost, updatePost, savePost, fetchSavedPosts } from '../../store/slices/postsSlice';
import { followUser, unfollowUser } from '../../store/slices/userSlice';
import formatDate from '../../utils/formatDate';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

const MOOD_EMOJI = { happy: '😊', sad: '😢', excited: '🤩', angry: '😠', calm: '😌', romantic: '❤️', funny: '😂', inspirational: '💪', nostalgic: '🥹', neutral: '😐' };

// ─── HEART BURST ──────────────────────────────────────────────────────────────
const HeartBurst = ({ visible }) => visible ? (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none', animation: 'heartBurst 0.8s ease forwards' }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
    </div>
) : null;

// ─── IMAGE CAROUSEL (your version) ───────────────────────────────────────────
const ImageCarousel = ({ images, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);
    if (!images?.length) return null;
    if (images.length === 1) return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ background: '#000' }}>
            <img src={images[0]} alt="Post" style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: '620px', objectFit: 'cover', display: 'block' }} />
        </div>
    );
    return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ position: 'relative' }}>
            <img src={images[current]} alt={`Post ${current + 1}`} style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: '620px', objectFit: 'cover', display: 'block', background: '#000' }} />
            {current > 0 && <button onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>‹</button>}
            {current < images.length - 1 && <button onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>›</button>}
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 600 }}>{current + 1} / {images.length}</div>
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', zIndex: 2 }}>
                {images.map((_, i) => <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); }} style={{ width: i === current ? '16px' : '6px', height: '6px', borderRadius: '3px', border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />)}
            </div>
        </div>
    );
};

// ─── POST MENU ────────────────────────────────────────────────────────────────
const PostMenu = ({ post, loggeduser, onEdit, onDelete, onSave, isSaved, onReport }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const isOwner = post.user._id === loggeduser?._id || post.user._id?.toString() === loggeduser?._id;

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)} className="bg-transparent border-0 cursor-pointer p-2 rounded-full text-gray-500 text-lg hover:bg-gray-100 transition-colors" title="Post options">⋯</button>
            {open && (
                <div className="absolute right-0 top-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden mt-1" style={{ minWidth: '170px' }}>
                    <button onClick={() => { onSave(); setOpen(false); }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm flex items-center gap-2 hover:bg-gray-50">
                        {isSaved ? '🔖 Unsave' : '🔖 Save post'}
                    </button>
                    {!isOwner && (
                        <button onClick={() => { onReport(); setOpen(false); }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm flex items-center gap-2 hover:bg-red-50 text-red-400">
                            🚩 Report post
                        </button>
                    )}
                    {isOwner && <>
                        <button onClick={() => { onEdit(); setOpen(false); }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm flex items-center gap-2 hover:bg-gray-50">
                            ✏️ Edit post
                        </button>
                        <button onClick={() => { onDelete(); setOpen(false); }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50">
                            🗑️ Delete post
                        </button>
                    </>}
                </div>
            )}
        </div>
    );
};

// ─── SHARE DIALOG ─────────────────────────────────────────────────────────────
const ShareDialog = ({ post, visible, onHide, loggeduser }) => {
    const [conversations, setConversations] = useState([]);
    const [sending, setSending] = useState(null);
    const postUrl = `${window.location.origin}/post/${post?._id}`;

    useEffect(() => {
        if (!visible || !loggeduser?._id) return;
        fetch(`${BASE}/api/conversation/${loggeduser._id}`)
            .then(r => r.json()).then(setConversations).catch(() => { });
    }, [visible, loggeduser]);

    const copyLink = () => { navigator.clipboard.writeText(postUrl); toast.success('Link copied!'); };

    const shareToConversation = async (conv) => {
        setSending(conv._id);
        const recipient = conv.participants.find(p => p.userId !== loggeduser._id);
        try {
            await fetch(`${BASE}/api/conversation/messages/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: conv._id, sender: loggeduser._id, senderName: loggeduser.fullname, content: `🔗 Shared a post: ${postUrl}`, recipientId: recipient?.userId }),
            });
            toast.success(`Shared to ${recipient?.fullname || 'conversation'}`);
        } catch { toast.error('Failed to share'); }
        setSending(null);
    };

    return (
        <Dialog header="Share post" visible={visible} style={{ width: '320px' }} onHide={onHide}>
            <div className="flex flex-col gap-3">
                <button onClick={copyLink} className="flex items-center gap-3 p-3 bg-gray-100 border-0 rounded-xl cursor-pointer font-semibold text-sm">🔗 Copy link</button>
                {conversations.length > 0 && <>
                    <p className="text-xs text-gray-500 font-bold m-0 uppercase tracking-wider">Send to</p>
                    {conversations.map(conv => {
                        const other = conv.participants.find(p => p.userId !== loggeduser._id);
                        return (
                            <button key={conv._id} onClick={() => shareToConversation(conv)} disabled={sending === conv._id}
                                className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-left">
                                <img src={other?.profilePicture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover" />
                                <span className="text-sm font-medium">{other?.fullname || 'Unknown'}</span>
                                {sending === conv._id && <span className="ml-auto text-xs text-indigo-500">Sending...</span>}
                            </button>
                        );
                    })}
                </>}
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
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${h}h ${m}m ${s}s`);
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [unlocksAt]);
    return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
            <span style={{ fontSize: '40px' }}>🔒</span>
            <p style={{ color: '#fff', fontWeight: 700, margin: '8px 0 4px', fontSize: '16px' }}>Time-Locked Post</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: 0 }}>Unlocks in {remaining}</p>
        </div>
    );
};

// ─── COLLABORATION INVITE BANNER ──────────────────────────────────────────────
const CollabInviteBanner = ({ post, loggeduser }) => {
    const collab = post.collaborators?.find(c => c.userId?.toString() === loggeduser?._id?.toString() && c.status === 'pending');
    const [contribution, setContribution] = useState('');
    const [done, setDone] = useState(false);
    if (!collab || done) return null;
    const respond = async (accepted) => {
        try {
            await axios.post(`${BASE}/api/post/collaborate/${accepted ? 'accept' : 'decline'}`, {
                postId: post._id, userId: loggeduser._id,
                contribution: accepted ? contribution : undefined,
            });
            toast.success(accepted ? 'Collaboration accepted!' : 'Declined');
            setDone(true);
        } catch { toast.error('Failed'); }
    };
    return (
        <div style={{ background: '#ede9fe', borderRadius: '8px', padding: '10px 12px', margin: '8px 16px 0' }}>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>🤝 You've been invited to collaborate!</p>
            <input type="text" placeholder="Add your contribution (optional)..." value={contribution} onChange={e => setContribution(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #c4b5fd', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => respond(true)} style={{ flex: 1, padding: '5px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Accept</button>
                <button onClick={() => respond(false)} style={{ flex: 1, padding: '5px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Decline</button>
            </div>
        </div>
    );
};

// ─── FEED ─────────────────────────────────────────────────────────────────────
const Feed = () => {
    const loaderRef = useRef(null);
    const isFetching = useRef(false);
    const dispatch = useDispatch();
    const { posts, loading, hasMore, nextCursor, savedPostIds } = useSelector(state => state.posts);
    const { loggeduser } = useSelector(state => state.users);
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [sharePost, setSharePost] = useState(null);
    const lastTap = useRef({});

    useEffect(() => {
        if (loggeduser?._id) {
            dispatch(fetchPosts({ userId: loggeduser._id }));
            dispatch(fetchSavedPosts(loggeduser._id));
        }
    }, [dispatch, loggeduser]);

    const loadMore = useCallback(() => {
        if (isFetching.current || !hasMore || loading.posts) return;
        isFetching.current = true;
        dispatch(fetchPosts({ cursor: nextCursor, userId: loggeduser?._id })).finally(() => { isFetching.current = false; });
    }, [dispatch, hasMore, nextCursor, loading.posts, loggeduser]);

    useEffect(() => {
        const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMore(); }, { threshold: 0.1 });
        const el = loaderRef.current;
        if (el) observer.observe(el);
        return () => { if (el) observer.unobserve(el); };
    }, [loadMore]);

    const toggleComments = postId => { dispatch(fetchComments(postId)); setVisiblePostId(prev => prev === postId ? null : postId); };
    const handleLikeToggle = post => dispatch(post?.likes?.includes(loggeduser?._id) ? unlikepost({ postId: post._id, userId: loggeduser._id }) : likepost({ postId: post._id, userId: loggeduser._id }));
    const handleImageDoubleClick = post => {
        if (!post?.likes?.includes(loggeduser?._id)) dispatch(likepost({ postId: post._id, userId: loggeduser._id }));
        setHeartVisible(prev => ({ ...prev, [post._id]: true }));
        setTimeout(() => setHeartVisible(prev => ({ ...prev, [post._id]: false })), 800);
    };
    const handleImageTap = post => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] || 0) < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    };
    const handleSave = post => {
        dispatch(savePost({ postId: post._id, userId: loggeduser._id }))
            .then(result => { if (result.payload?.saved !== undefined) toast.success(result.payload.saved ? 'Post saved!' : 'Post unsaved'); });
    };
    const handleDelete = post => {
        if (!window.confirm('Delete this post?')) return;
        dispatch(deletePost({ postId: post._id, userId: loggeduser._id })).then(() => toast.success('Post deleted'));
    };
    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        dispatch(updatePost({ postId: editingPost._id, userId: loggeduser._id, caption: editCaption }))
            .then(() => { toast.success('Post updated'); setEditingPost(null); });
    };
    const handleFollow = post => {
        const isFollowing = loggeduser.following?.includes(post.user._id);
        dispatch(isFollowing
            ? unfollowUser({ loggedUserId: loggeduser._id, unfollowUserId: post.user._id })
            : followUser({ loggedUserId: loggeduser._id, followUserId: post.user._id })
        );
    };
    const handleReport = async post => {
        const reasons = ['spam', 'harassment', 'hate_speech', 'misinformation', 'nudity', 'violence', 'other'];
        const reason = window.prompt(`Report reason:\n${reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nEnter number:`);
        if (!reason) return;
        const idx = parseInt(reason) - 1;
        if (idx < 0 || idx >= reasons.length) { toast.error('Invalid choice'); return; }
        try {
            await axios.post(`${BASE}/api/admin/report`, { reporterId: loggeduser._id, targetType: 'post', targetId: post._id, reason: reasons[idx] });
            toast.success('Report submitted. Thank you!');
        } catch (e) { toast.error(e.response?.data?.error || 'Failed to report'); }
    };

    const getImages = post => post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    // Your caption renderer — highlights #hashtags and @mentions
    const renderCaption = (caption = '') => {
        return caption.split(/(\s+)/).map((token, index) => {
            if (/^#[\w]+$/.test(token) || /^@[\w.]+$/.test(token)) {
                return <span key={index} className="text-indigo-500 font-medium">{token}</span>;
            }
            return <span key={index}>{token}</span>;
        });
    };

    return (
        <>
            <style>{`
                @keyframes heartBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}70%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
                .music-tag{animation:musicPulse 2s ease-in-out infinite}
                @keyframes musicPulse{0%,100%{opacity:1}50%{opacity:0.6}}
            `}</style>

            <div>
                {loading.posts && posts.length === 0 ? (
                    <div className="mt-3 flex flex-col gap-3">{[1, 2, 3].map(i => <SkeletonPost key={i} />)}</div>
                ) : (
                    <div className="mt-3 flex flex-col gap-4">
                        {posts.length > 0 ? posts.map((post, index) => {
                            const images = getImages(post);
                            // Anonymous posts: never claim ownership in feed (owner sees via profile tab)
                            const isOwn = !post.isAnonymous && (post.user._id === loggeduser?._id || post.user._id?.toString() === loggeduser?._id);
                            const isFollowing = loggeduser?.following?.includes(post.user._id);
                            const isSaved = savedPostIds.includes(post._id);
                            const locked = post.unlocksAt && new Date(post.unlocksAt) > Date.now() && !isOwn;
                            const expiryRemaining = post.expiresAt ? Math.max(0, new Date(post.expiresAt) - Date.now()) : null;

                            return (
                                <article key={post._id || index} className="relative overflow-hidden w-full rounded-2xl shadow-sm flex flex-col border bg-white">

                                    {/* Collaboration invite banner */}
                                    <CollabInviteBanner post={post} loggeduser={loggeduser} />

                                    {/* Header */}
                                    <div className="flex items-start justify-between px-4 py-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={post.user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h6 className="m-0 font-semibold text-sm leading-tight">{post.user.fullname}</h6>
                                                    {post.isAnonymous && <span style={{ fontSize: '10px', background: '#ede9fe', color: '#6366f1', borderRadius: '10px', padding: '1px 6px' }}>🎭 Anonymous</span>}
                                                    {post.isCollaborative && post.collaborators?.some(c => c.status === 'accepted') && (
                                                        <span style={{ fontSize: '10px', background: '#d1fae5', color: '#059669', borderRadius: '10px', padding: '1px 6px' }}>🤝 Collab</span>
                                                    )}
                                                    {!isOwn && (
                                                        <button onClick={() => handleFollow(post)}
                                                            className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer font-semibold transition ${isFollowing ? 'border-gray-200 bg-transparent text-gray-500 hover:bg-gray-50' : 'border-indigo-500 bg-[#808bf5] text-white hover:opacity-95'}`}>
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
                                            {post.music?.title && (
                                                <div className="music-tag flex items-center gap-1 bg-pink-50 rounded-full px-2 py-1 text-[11px] text-pink-500 font-medium max-w-[130px] truncate">
                                                    🎵 {post.music.title}
                                                </div>
                                            )}
                                            {expiryRemaining !== null && expiryRemaining < 3600000 && (
                                                <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', borderRadius: '10px', padding: '1px 6px' }}>⏳ Expiring soon</span>
                                            )}
                                            <PostMenu post={post} loggeduser={loggeduser} isSaved={isSaved}
                                                onSave={() => handleSave(post)}
                                                onEdit={() => { setEditingPost(post); setEditCaption(post.caption); }}
                                                onDelete={() => handleDelete(post)}
                                                onReport={() => handleReport(post)}
                                            />
                                        </div>
                                    </div>

                                    {/* Images with time-lock overlay */}
                                    {images.length > 0 && (
                                        <div className="relative border-y border-gray-100">
                                            <ImageCarousel images={images} onDoubleClick={() => !locked && handleImageDoubleClick(post)} onTouchEnd={() => !locked && handleImageTap(post)} />
                                            {locked && <TimeLockOverlay unlocksAt={post.unlocksAt} />}
                                            <HeartBurst visible={!!heartVisible[post._id]} />
                                        </div>
                                    )}

                                    {/* Locked text post (no image) */}
                                    {locked && images.length === 0 && (
                                        <div style={{ background: '#f3f4f6', margin: '0 16px', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '32px', margin: 0 }}>🔒</p>
                                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>This post is time-locked</p>
                                        </div>
                                    )}

                                    {/* Collaborators' contributions */}
                                    {post.isCollaborative && post.collaborators?.filter(c => c.status === 'accepted' && c.contribution).length > 0 && (
                                        <div style={{ margin: '0 16px', background: '#f0fdf4', borderRadius: '8px', padding: '8px 12px' }}>
                                            <p style={{ fontSize: '11px', color: '#059669', fontWeight: 600, margin: '0 0 4px' }}>🤝 Collaborators added:</p>
                                            {post.collaborators.filter(c => c.status === 'accepted' && c.contribution).map((c, i) => (
                                                <p key={i} style={{ fontSize: '12px', margin: '2px 0', color: '#374151' }}>
                                                    <strong>{c.fullname}:</strong> {c.contribution}
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    {/* Voice note */}
                                    {post.voiceNote?.url && (
                                        <div style={{ margin: '0 16px' }}>
                                            <audio src={post.voiceNote.url} controls style={{ width: '100%', height: '36px' }} />
                                        </div>
                                    )}

                                    {/* Actions — hidden when locked */}
                                    {!locked && (
                                        <div className="bg-white text-gray-900 w-full px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-4">
                                                    <div onClick={() => handleLikeToggle(post)} className="flex items-center gap-2 cursor-pointer">
                                                        <Like isliked={post?.likes?.includes(loggeduser?._id)} loading={post?.likes?.includes(loggeduser?._id) ? loading.like : loading.unlike} />
                                                    </div>
                                                    <button onClick={() => toggleComments(post._id)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900" title="Comments">
                                                        <i className="pi pi-comment" style={{ fontSize: '1.2rem' }}></i>
                                                    </button>
                                                    <button onClick={() => setSharePost(post)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900" title="Share">
                                                        <i className="pi pi-send" style={{ fontSize: '1.15rem' }}></i>
                                                    </button>
                                                    <button onClick={() => handleSave(post)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer ml-auto p-0" title={isSaved ? 'Unsave' : 'Save'}>
                                                        <i className={`pi ${isSaved ? 'pi-bookmark-fill' : 'pi-bookmark'}`} style={{ fontSize: '1.1rem', color: isSaved ? '#808bf5' : 'currentColor' }}></i>
                                                    </button>
                                                </div>
                                                <p className="m-0 mt-2 text-sm font-semibold">{(post?.likes?.length || 0).toLocaleString()} likes</p>
                                                <p className="m-0 mt-1 text-sm leading-relaxed">
                                                    <span className="font-semibold mr-1">{post.user.username || post.user.fullname}</span>
                                                    {renderCaption(post.caption || '')}
                                                </p>
                                                <p className="m-0 mt-1 text-xs text-gray-500 cursor-pointer" onClick={() => toggleComments(post._id)}>
                                                    View all {post.comments?.length || 0} comments
                                                </p>
                                                <p className="m-0 mt-2 text-[10px] text-gray-400 uppercase tracking-wide">{formatDate(post.updatedAt)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {visiblePostId === post._id && <Comment postId={post._id} setVisible={() => setVisiblePostId(null)} />}
                                </article>
                            );
                        }) : <p className="text-center text-gray-400 py-8">No posts to display.</p>}

                        {/* Infinite scroll sentinel */}
                        <div ref={loaderRef} className="h-10 flex items-center justify-center">
                            {loading.posts && posts.length > 0 && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                            {!hasMore && posts.length > 0 && <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>}
                        </div>
                    </div>
                )}

                {sharePost && <ShareDialog post={sharePost} visible={!!sharePost} onHide={() => setSharePost(null)} loggeduser={loggeduser} />}

                <Dialog header="Edit Post" visible={!!editingPost} style={{ width: '340px' }} onHide={() => setEditingPost(null)}>
                    {editingPost && (
                        <div className="flex flex-col gap-3">
                            <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={4}
                                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-y" />
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