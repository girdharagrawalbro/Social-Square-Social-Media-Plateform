import React, { useEffect, useRef, useState, useMemo } from "react";
import { useInView } from 'react-intersection-observer';
import SkeletonPost from './ui/SkeletonPost';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import ReportDialog from './ui/ReportDialog';

import toast from 'react-hot-toast';
import UserProfile from './UserProfile';
import FollowFollowingList from './FollowFollowingList';
import formatDate from '../../utils/formatDate';
import { useDarkMode } from '../../context/DarkModeContext';

import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import PollCard from './PollCard';
import {
    useFeed, useMoodFeed,
    useLikePost, useSavePost, useDeletePost, useUpdatePost,
    useRecommendedPosts, useReactPost
} from '../../hooks/queries/usePostQueries';
import { useAcceptCollaboration, useDeclineCollaboration, useReportPost } from '../../hooks/queries/usePostOperationsQueries';
import usePostStore from '../../store/zustand/usePostStore';
import SharePostDialog from './ui/SharePostDialog';
import ReactionPicker from './ReactionPicker';
import PostMenu from './ui/PostMenu';
import { usePrefetchUserProfile, useFollowUser } from '../../hooks/queries/useAuthQueries';
import { usePrefetchPost } from '../../hooks/queries/usePostQueries';
import ProgressiveImage from './ui/ProgressiveImage';
import { getMediaThumbnail } from '../../utils/mediaUtils';


const PostActivityTracker = ({ postId, onDwell }) => {
    const { ref, inView } = useInView({ threshold: 0.7 });
    const startTime = useRef(null);

    useEffect(() => {
        if (inView) {
            startTime.current = Date.now();
        } else if (startTime.current && !inView) {
            const dwellTime = Date.now() - startTime.current;
            if (dwellTime > 1000) onDwell(postId, dwellTime);
            startTime.current = null;
        }
    }, [inView, postId, onDwell]);

    return <div ref={ref} className="absolute inset-0 pointer-events-none" />;
};

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
            <ProgressiveImage src={images[0]} alt="Post" maxHeight={"600px"} objectFit="contain" />
        </div>
    );
    return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ position: 'relative' }}>
            <ProgressiveImage src={images[current]} alt={`${current + 1}`} objectFit="contain" style={{ background: '#000' }} />
            {current > 0 && <button aria-label="Previous image" onClick={e => { e.stopPropagation(); setCurrent(c => c - 1) }} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
            {current < images.length - 1 && <button aria-label="Next image" onClick={e => { e.stopPropagation(); setCurrent(c => c + 1) }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 600 }}>{current + 1}/{images.length}</div>
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', zIndex: 2 }}>
                {images.map((_, i) => <button aria-label={`Go to image ${i + 1}`} key={i} onClick={e => { e.stopPropagation(); setCurrent(i) }} style={{ width: i === current ? '16px' : '6px', height: '6px', borderRadius: '3px', border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />)}
            </div>
        </div>
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

const FeedVideo = ({ src, poster, onDoubleClick, onTouchEnd, isLocked }) => {
    const videoRef = useRef(null);
    const isMuted = usePostStore(s => s.isMuted);
    const setIsMuted = usePostStore(s => s.setIsMuted);
    const { ref, inView } = useInView({
        threshold: 0.6,
    });

    useEffect(() => {
        if (!videoRef.current) return;
        if (inView && !isLocked) {
            videoRef.current.play().catch(() => { });
        } else {
            videoRef.current.pause();
        }
    }, [inView, isLocked]);

    const toggleMute = (e) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    return (
        <div ref={ref} className="relative w-full bg-black overflow-hidden group">
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                loop
                muted={isMuted}
                playsInline
                onDoubleClick={onDoubleClick}
                onTouchEnd={onTouchEnd}
                className="w-full h-full object-contain cursor-pointer max-h-[600px]"
            />
            <button
                onClick={toggleMute}
                className="absolute bottom-2 right-2 z-10 w-6 h-6 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border-0 cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-lg"
                title={isMuted ? "Unmute" : "Mute"}
            >
                <i className={`pi ${isMuted ? 'pi-volume-off' : 'pi-volume-up'}`} style={{ fontSize: '14px' }}></i>
            </button>
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
        <div style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '12px', margin: '8px 16px 0', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#808bf5' }}>🤝 You've been invited to collaborate!</p>
            <input
                type="text"
                placeholder="Add your contribution..."
                value={contribution}
                onChange={e => setContribution(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-1)', color: 'var(--text-main)', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => respond(true)}
                    disabled={acceptMut.isPending || !contribution.trim()}
                    style={{ flex: 1, padding: '8px', background: contribution.trim() ? '#808bf5' : 'var(--surface-3)', color: contribution.trim() ? '#fff' : 'var(--text-sub)', border: 'none', borderRadius: '10px', cursor: contribution.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700, opacity: acceptMut.isPending ? 0.6 : 1, transition: 'all 0.2s' }}>
                    Accept
                </button>
                <button
                    onClick={() => respond(false)}
                    disabled={declineMut.isPending}
                    style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, opacity: declineMut.isPending ? 0.6 : 1 }}>
                    Decline
                </button>
            </div>
        </div>
    );
};

// ─── POST ITEM (MEMOIZED) ───────────────────────────────────────────────────
const PostItem = React.memo(({
    post, user, isLikedByMe, likesCount, isSavedByMe, isFollowing, heartVisible,
    visiblePostId, pickerPostId, savingPostIds,
    onLikeToggle, onImageDoubleClick, onImageTap, onSave, onDelete, onReport,
    onShareToStory, onProfileClick, onSharePost, onEdit,
    setVisibleCommentId, setPickerPostId, handleDwell, handleReact, renderCaption, onFollow,
    onLikesClick
}) => {
    const prefetchUser = usePrefetchUserProfile();
    const prefetchPost = usePrefetchPost();

    const getImages = post => post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    const images = getImages(post);
    const isOwn = !post.isAnonymous && (post.user._id === user?._id || post.user._id?.toString() === user?._id);
    const locked = post.unlocksAt && new Date(post.unlocksAt) > Date.now() && !isOwn;
    const expiryRemaining = post.expiresAt ? Math.max(0, new Date(post.expiresAt) - Date.now()) : null;
    const setPostDetailId = usePostStore(s => s.setPostDetailId);

    return (
        <article className="relative overflow-hidden w-full rounded-2xl border flex flex-col bg-white dark:bg-black mb-3 px-0 sm:px-0">
            <PostActivityTracker postId={post._id} onDwell={handleDwell} />
            <CollabInviteBanner post={post} user={user} />

            {/* Header */}
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="relative w-10 h-10 flex-shrink-0"
                        onClick={() => onProfileClick(post.user._id)}
                        onMouseEnter={() => prefetchUser(post.user._id)}
                    >
                        <div className={`w-10 h-10 rounded-full overflow-hidden cursor-pointer hover:opacity-80 transition border ${post.user.isOnline ? 'presence-glow' : 'border-gray-100'}`}>
                            <img
                                src={post.user?.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'}
                                alt="Profile"
                                loading="lazy"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {post.user.isOnline && <div className="presence-dot" />}
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <div className="m-0 text-sm leading-none flex items-center gap-1 flex-wrap text-[var(--text-main)] shrink-0">
                                <span
                                    className="font-bold cursor-pointer hover:text-[#808bf5] transition"
                                    onClick={() => onProfileClick(post.user._id)}
                                >
                                    {post.user.fullname}
                                </span>
                                {post.collaborators?.filter(c => c.status === 'accepted').length > 0 && (() => {
                                    const collab = post.collaborators.find(c => c.status === 'accepted');
                                    return (
                                        <>
                                            <span className="text-[var(--text-sub)] font-normal ml-0.5">&</span>
                                            <span
                                                className="font-bold cursor-pointer hover:text-[#808bf5] transition ml-0.5"
                                                onClick={() => onProfileClick(collab.userId || collab._id)}
                                            >
                                                {collab.fullname}
                                                {post.collaborators.filter(c => c.status === 'accepted').length > 1 && ` & ${post.collaborators.filter(c => c.status === 'accepted').length - 1} others`}
                                            </span>
                                        </>
                                    );
                                })()}
                                {post.user.isVerified && <i className="pi pi-check-circle text-blue-500 ml-1" style={{ fontSize: '11px' }}></i>}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-none shrink-0">{formatDate(post.updatedAt)}</span>
                            {/* {post.isAnonymous && <span style={{ fontSize: '10px', background: '#ede9fe', color: '#6366f1', borderRadius: '10px', padding: '1px 6px' }} className="leading-none">🎭 Anonymous</span>} */}

                            {!isOwn && !isFollowing && !post.isAnonymous && (
                                <button
                                    onClick={() => onFollow(post.user._id)}
                                    className="text-[10px] px-2.5 py-1 rounded-full border border-indigo-500 bg-[#808bf5] text-white cursor-pointer font-semibold transition leading-none h-6 flex items-center"
                                >
                                    Follow
                                </button>
                            )}
                        </div>
                        {post.location?.name && (
                            <div className="flex items-center gap-1 mt-1">
                                <i className="pi pi-map-marker text-[9px] text-gray-400"></i>
                                <span className="text-[10px] text-gray-400 font-medium">{post.location.name}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                    {post.music?.title && <div className="music-tag flex items-center gap-1 bg-pink-50 rounded-full px-2 py-1 text-[11px] text-pink-500 font-medium max-w-[130px] truncate">🎵 {post.music.title}</div>}
                    {expiryRemaining !== null && expiryRemaining < 3600000 && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', borderRadius: '10px', padding: '1px 6px' }}>⏳ Expiring soon</span>}
                    <PostMenu post={post} user={user} isSaved={isSavedByMe}
                        onSave={() => onSave(post)}
                        onEdit={() => onEdit(post)}
                        onDelete={() => onDelete(post)}
                        onReport={() => onReport(post)}
                        onShareToStory={() => onShareToStory(post)}
                        isSaving={savingPostIds.has(post._id)}
                    />
                </div>
            </div>

            {/* Images */}
            {images.length > 0 && (
                <div className="relative mx-0 sm:mx-2 rounded-sm overflow-hidden" onMouseEnter={() => prefetchPost(post._id)}>
                    <ImageCarousel images={images} onDoubleClick={() => !locked && onImageDoubleClick(post)} onTouchEnd={() => !locked && onImageTap(post)} />
                    {locked && <TimeLockOverlay unlocksAt={post.unlocksAt} />}
                    <HeartBurst visible={heartVisible} />
                </div>
            )}

            {/* Video */}
            {post.video && !post.image_urls?.length && !post.image_url && (
                <div className="relative mx-0 sm:mx-2 rounded-sm overflow-hidden">
                    <FeedVideo
                        src={post.video}
                        poster={post.videoThumbnail || getMediaThumbnail(post.video, 'video')}
                        onDoubleClick={() => !locked && onImageDoubleClick(post)}
                        onTouchEnd={() => !locked && onImageTap(post)}
                        isLocked={locked}
                    />
                    <HeartBurst visible={heartVisible} />
                    {locked && <TimeLockOverlay unlocksAt={post.unlocksAt} />}
                </div>
            )}

            {post.poll && <PollCard poll={post.poll} postId={post._id} />}

            {locked && images.length === 0 && (
                <div style={{ background: '#f3f4f6', margin: '0 16px', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '32px', margin: 0 }}>🔒</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>This post is time-locked</p>
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
                <div className="bg-white dark:bg-black text-[var(--text-main)] w-full p-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                            <div
                                className="relative flex items-center gap-2 cursor-pointer"
                                onMouseEnter={() => !window.matchMedia('(pointer: coarse)').matches && setPickerPostId(post._id)}
                                onMouseLeave={() => setPickerPostId(null)}
                            >
                                <div className="flex items-center gap-2">
                                    <div onClick={(e) => { e.stopPropagation(); onLikeToggle(post); }} className="cursor-pointer">
                                        <Like id={`like-${post._id}`} isliked={isLikedByMe} />
                                    </div>
                                    <span
                                        className="cursor-pointer hover:text-[#808bf5] transition-colors font-bold"
                                        onClick={(e) => { e.stopPropagation(); onLikesClick(post.likes || []); }}
                                    >
                                        {likesCount.toLocaleString()}
                                    </span>
                                </div>

                                {pickerPostId === post._id && (
                                    <ReactionPicker
                                        onSelect={(emoji) => handleReact(post, emoji)}
                                        onClose={() => setPickerPostId(null)}
                                    />
                                )}

                                {post.reactions?.length > 0 && (
                                    <div className="flex gap-2 -space-x-1 ml-1 items-center bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
                                        {[...new Set(post.reactions.map(r => r.emoji))].slice(0, 3).map((emoji, i) => (
                                            <span key={i} className="text-[10px] leading-none">{emoji}</span>
                                        ))}
                                        <span className="text-[10px] text-[var(--text-sub)] ml-1 font-bold">{post.reactions.length}</span>
                                    </div>
                                )}
                            </div>
                            <button aria-label={visiblePostId === post._id ? "Close comments" : "Open comments"} onClick={(e) => { e.stopPropagation(); setVisibleCommentId(p => p === post._id ? null : post._id); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)] gap-2">
                                <i className="pi pi-comment" style={{ fontSize: '1.2rem' }}></i> {post.comments?.length || 0}
                            </button>
                            <button aria-label="Share post" onClick={(e) => { e.stopPropagation(); onSharePost(post); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)]">
                                <i className="pi pi-send" style={{ fontSize: '1.15rem' }}></i>
                            </button>
                            <button aria-label="View post details" onClick={(e) => { e.stopPropagation(); setPostDetailId(post._id); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)] ml-auto" style={{ marginRight: '4px' }}>
                                <i className="pi pi-external-link" style={{ fontSize: '1rem' }}></i>
                            </button>
                            <button aria-label={isSavedByMe ? 'Unsave post' : 'Save post'} onClick={(e) => { e.stopPropagation(); onSave(post); }} disabled={savingPostIds.has(post._id)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0" style={{ opacity: savingPostIds.has(post._id) ? 0.5 : 1, pointerEvents: savingPostIds.has(post._id) ? 'none' : 'auto' }}>
                                <i className={`pi ${isSavedByMe ? 'pi-bookmark-fill' : 'pi-bookmark'}`} style={{ fontSize: '1.1rem', color: isSavedByMe ? '#808bf5' : 'currentColor' }}></i>
                            </button>
                        </div>
                        <p className="m-0 mt-1 text-sm leading-relaxed">
                            <span
                                className="font-semibold mr-1 cursor-pointer hover:text-indigo-600 transition"
                                onClick={() => onProfileClick(post.user._id)}
                            >
                                {post.user.username || post.user.fullname}
                            </span>
                            {renderCaption(post.caption || '')}
                        </p>
                        {post.isCollaborative && post.collaborators?.filter(c => c.status === 'accepted').map((c, i) => (
                            <p key={i} className="m-0 mt-0.5 text-sm leading-relaxed">
                                <span
                                    className="font-semibold mr-1 cursor-pointer hover:text-indigo-600 transition"
                                    onClick={() => onProfileClick(c.userId)}
                                >
                                    {c.username || c.fullname}
                                </span>
                                {renderCaption(c.contribution || '')}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {visiblePostId === post._id && <Comment postId={post._id} setVisible={() => setVisibleCommentId(null)} onProfileClick={onProfileClick} />}
        </article>
    );
});

// ─── FEED ─────────────────────────────────────────────────────────────────────
const Feed = ({ activeMood = null }) => {
    // ✅ Zustand
    const user = useAuthStore(s => s.user);
    const { isDark } = useDarkMode();
    // const followUser = useAuthStore(s => s.followUser);
    // const unfollowUser = useAuthStore(s => s.unfollowUser);
    const rawSocketPosts = usePostStore(s => s.socketPosts);
    const socketPosts = useMemo(() => rawSocketPosts || [], [rawSocketPosts]);
    const isSaved = usePostStore(s => s.isSaved);
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);

    // ✅ TanStack Query
    const feedQuery = useFeed(user?._id);
    const recommendedQuery = useRecommendedPosts(user?._id);
    const moodQuery = useMoodFeed(activeMood || user?.preferredMood || '', user?._id);
    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const reactMutation = useReactPost();
    const followMutation = useFollowUser();

    const [pickerPostId, setPickerPostId] = useState(null);
    const reportMutation = useReportPost();
    // const setPostDetailId = usePostStore(s => s.setPostDetailId);

    const [liveInjectedPosts] = useState({});
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [sharePost, setSharePost] = useState(null);
    const [savingPostIds, setSavingPostIds] = useState(new Set());
    const [reportPost, setReportPost] = useState(null);
    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [likesVisible, setLikesVisible] = useState(false);
    const [likesIds, setLikesIds] = useState([]);
    const lastTap = useRef({});

    const handleReact = (post, emoji) => {
        if (navigator.vibrate) navigator.vibrate(15);
        reactMutation.mutate({ postId: post._id, emoji });
        setPickerPostId(null);
    };

    const handleFollow = (targetUserId) => {
        if (!targetUserId) return;
        followMutation.mutate({ targetUserId });
    };

    // Infinite scroll sentinel
    const { ref: loaderRef, inView } = useInView({ threshold: 0.1 });
    useEffect(() => {
        if (inView && !activeMood && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
        }
    }, [inView, activeMood, feedQuery]);

    // Merge pages + socket posts
    const serverPosts = useMemo(() => feedQuery.data?.pages?.flatMap(p => p.posts) || [], [feedQuery.data?.pages]);
    const recommendedPosts = useMemo(() => (recommendedQuery.data || []).map(p => ({ ...p, isRecommended: true })), [recommendedQuery.data]);
    const moodPosts = useMemo(() => (moodQuery.data || []).map(p => ({ ...p, isMoodMatch: true })), [moodQuery.data]);

    const randomWeights = useRef({});

    const displayPosts = useMemo(() => {
        let all = [];

        if (activeMood) {
            // Show ONLY mood-matched posts when a filter is active
            all = [...moodPosts];
        } else {
            // Mixed feed for general viewing
            all = [...serverPosts, ...recommendedPosts, ...moodPosts];
        }

        // prepend socket posts
        const socketNew = socketPosts.filter(sp => !all.some(p => p._id === sp._id));
        all = [...socketNew, ...all];

        // Deduplicate
        const uniqueEntries = Array.from(new Map(all.map(p => [p._id, p])).values());

        // Assign stable random weights for this session if not already assigned
        uniqueEntries.forEach(p => {
            if (randomWeights.current[p._id] === undefined) {
                randomWeights.current[p._id] = Math.random();
            }
        });

        // Shuffle by random weights (Stable per session, random on refresh)
        let finalArray = uniqueEntries.sort((a, b) =>
            randomWeights.current[a._id] - randomWeights.current[b._id]
        );

        // Inject live recommendations
        let withInjections = [];
        let seen = new Set();
        finalArray.forEach(p => {
            if (seen.has(p._id)) return;
            seen.add(p._id);
            withInjections.push(p);

            if (liveInjectedPosts[p._id]) {
                liveInjectedPosts[p._id].forEach(ip => {
                    if (!seen.has(ip._id)) {
                        seen.add(ip._id);
                        withInjections.push({ ...ip, isLiveInjected: true });
                    }
                });
            }
        });

        return withInjections;
    }, [serverPosts, recommendedPosts, moodPosts, socketPosts, liveInjectedPosts, activeMood]);


    const handleLikeToggle = async (post) => {
        if (likeMutation.isPending) return;

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);

        const loggedUserId = user?._id?.toString();
        const optimisticSet = optimisticLikes[post._id];

        const liked = optimisticSet
            ? Array.from(optimisticSet).some(id => id?.toString() === loggedUserId)
            : (post.likes || []).some(id => id?.toString() === loggedUserId);

        likeMutation.mutate({
            postId: post._id,
            isLiked: liked,
            likes: post.likes || []
        });
    };

    const handleImageDoubleClick = async post => {
        const optimisticSet = optimisticLikes[post._id];
        const liked = optimisticSet
            ? optimisticSet.has(user?._id)
            : post.likes?.includes(user?._id);

        if (!liked) {
            if (navigator.vibrate) navigator.vibrate([10, 30]);
            likeMutation.mutate({
                postId: post._id,
                isLiked: false,
                likes: post.likes || []
            });
        }
        setHeartVisible(p => ({ ...p, [post._id]: true }));
        setTimeout(() => setHeartVisible(p => ({ ...p, [post._id]: false })), 800);
    };

    const handleImageTap = post => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] || 0) < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    };

    const handleSave = post => {
        setSavingPostIds(prev => new Set([...prev, post._id]));
        const wasSaved = isSaved(post._id);
        toggleSaved(post._id, !wasSaved);
        saveMutation.mutate({ postId: post._id }, {
            onError: () => {
                toggleSaved(post._id, wasSaved);
                toast.error('Failed to save');
            },
            onSettled: () => {
                setSavingPostIds(prev => {
                    const next = new Set(prev);
                    next.delete(post._id);
                    return next;
                });
            },
        });
    };

    const handleDelete = post => {
        confirmDialog({
            message: 'Are you sure you want to delete this post?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                deleteMutation.mutate({ postId: post._id }, {
                    onSuccess: () => toast.success('Post deleted'),
                });
            }
        });
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: editingPost._id, caption: editCaption }, {
            onSuccess: () => { toast.success('Updated'); setEditingPost(null); }
        });
    };

    const handleReport = (post) => {
        setReportPost(post);
    };

    const handleProfileClick = (userId) => {
        setSelectedProfileId(userId);
        setProfileVisible(true);
    };

    const submitReport = async (reason) => {
        try {
            await reportMutation.mutateAsync({ postId: reportPost._id, reason });
            toast.success('Report submitted. Thank you!');
            setReportPost(null);
        } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const renderCaption = (caption = '') => caption.split(/(\s+)/).map((token, i) => {
        if (/^#[\w]+$/.test(token) || /^@[\w.]+$/.test(token))
            return <span key={i} className="text-indigo-500 font-medium">{token}</span>;
        return <span key={i}>{token}</span>;
    });

    const isLoading = feedQuery.isLoading && displayPosts.length === 0;

    const activityQueue = useRef([]);
    useEffect(() => {
        const flush = async () => {
            if (activityQueue.current.length === 0) return;
            const batch = [...activityQueue.current];
            activityQueue.current = [];
            try {
                await api.post('/api/recommendation/batch-activity', { activities: batch });
            } catch (e) {
                // If it fails, we don't want to retry endlessly to stay 'unobtrusive'
            }
        };
        const interval = setInterval(flush, 10000); // Flush every 10s
        window.addEventListener('beforeunload', flush);
        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', flush);
            flush();
        };
    }, []);

    const handleDwell = (postId, dwellTime) => {
        if (dwellTime < 1000) return; // Only track significant interest
        activityQueue.current.push({
            postId,
            action: 'dwell',
            duration: dwellTime,
            timestamp: Date.now() / 1000
        });
    };

    return (
        <>
            <style>{`
                @keyframes heartBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
                .music-tag{animation:musicPulse 2s ease-in-out infinite}
                @keyframes musicPulse{0%,100%{opacity:1}50%{opacity:0.6}}
            `}</style>

            <div>
                {isLoading ? (
                    <div className="mt-1 flex flex-col">{[1, 2, 3].map(i => <SkeletonPost key={i} />)}</div>
                ) : (
                    <div className="mt-1 flex flex-col">
                        {displayPosts.length > 0 ? displayPosts.map((post, index) => (
                            <PostItem
                                key={post._id || index}
                                post={post}
                                user={user}
                                isLikedByMe={optimisticLikes[post._id]
                                    ? Array.from(optimisticLikes[post._id]).some(id => id?.toString() === user?._id?.toString())
                                    : (post.likes || []).some(id => id?.toString() === user?._id?.toString())
                                }
                                likesCount={optimisticLikes[post._id] ? optimisticLikes[post._id].size : (post.likes?.length || 0)}
                                isSavedByMe={isSaved(post._id)}
                                isFollowing={user?.following?.some(f => f?.toString() === post.user._id?.toString())}
                                heartVisible={!!heartVisible[post._id]}
                                visiblePostId={visiblePostId}
                                pickerPostId={pickerPostId}
                                savingPostIds={savingPostIds}
                                onLikeToggle={handleLikeToggle}
                                onImageDoubleClick={handleImageDoubleClick}
                                onImageTap={handleImageTap}
                                onSave={handleSave}
                                onDelete={handleDelete}
                                onReport={handleReport}
                                onShareToStory={setSharingPostToStory}
                                onProfileClick={handleProfileClick}
                                onSharePost={setSharePost}
                                onEdit={(p) => { setEditingPost(p); setEditCaption(p.caption) }}
                                setVisibleCommentId={setVisiblePostId}
                                setPickerPostId={setPickerPostId}
                                handleDwell={handleDwell}
                                handleReact={handleReact}
                                renderCaption={renderCaption}
                                onFollow={handleFollow}
                                onLikesClick={(ids) => { setLikesIds(ids); setLikesVisible(true); }}
                            />
                        )) : (
                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                <div className={`relative w-24 h-24 mb-6 flex items-center justify-center rounded-3xl rotate-12 transition-transform hover:rotate-0 duration-500 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-50 border-gray-100'} border-2 shadow-xl`}>
                                    <span className="text-5xl animate-bounce">📬</span>
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-4 border-white dark:border-black animate-pulse"></div>
                                </div>
                                <h3 className={`text-2xl font-bold mb-2 font-outfit ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {activeMood ? `No ${activeMood} vibes yet` : 'Your feed is waiting'}
                                </h3>
                                <p className="text-gray-500 max-w-[280px] text-sm leading-relaxed mb-3">
                                    {activeMood
                                        ? `Be the first to share a post with the ${activeMood} mood!`
                                        : "Follow more people or share your first moment to see what's happening around you."
                                    }
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                        className="px-6 py-2.5 rounded-2xl bg-[#808bf5] text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:scale-105 transition-all cursor-pointer border-0"
                                    >
                                        Explore Trends
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sentinel */}
                        <div ref={loaderRef} className="h-10 flex items-center justify-center">
                            {feedQuery.isFetchingNextPage && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                            {!activeMood && !feedQuery.hasNextPage && displayPosts.length > 0 && <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>}
                        </div>
                    </div>
                )}

                {sharePost && <SharePostDialog
                    visible={!!sharePost}
                    onHide={() => setSharePost(null)}
                    post={sharePost}
                    user={user}
                    onShareToStory={() => setSharingPostToStory(sharePost)}
                />}

                {reportPost && <ReportDialog
                    visible={!!reportPost}
                    onHide={() => setReportPost(null)}
                    onSubmit={submitReport}
                    loading={reportMutation.isPending}
                />}

                <Dialog header={false} visible={!!editingPost} style={{ width: '95vw', maxWidth: '420px', borderRadius: '24px' }} onHide={() => setEditingPost(null)} closable={false}>
                    {editingPost && (
                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="m-0 text-xl font-bold text-gray-900 font-outfit">Edit Post</h3>
                                <button onClick={() => setEditingPost(null)} className="bg-gray-100 border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-200">✕</button>
                            </div>
                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                                <img src={editingPost.user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                                <span className="font-semibold text-sm">{editingPost.user.fullname}</span>
                            </div>
                            <div className="relative">
                                <textarea
                                    value={editCaption}
                                    onChange={e => setEditCaption(e.target.value)}
                                    rows={6}
                                    placeholder="Write your new caption..."
                                    className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:border-indigo-400 outline-none transition font-medium"
                                />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setEditingPost(null)} className="flex-1 py-3 border-2 border-gray-100 rounded-2xl bg-white cursor-pointer text-sm font-bold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                                <button onClick={handleEditSubmit} disabled={updateMutation.isPending} className="flex-1 py-3 bg-[#808bf5] text-white border-0 rounded-2xl cursor-pointer text-sm font-bold shadow-lg shadow-indigo-200 hover:opacity-90 transition disabled:opacity-50">
                                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}
                </Dialog>

                <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }} onHide={() => setProfileVisible(false)}>
                    <UserProfile id={selectedProfileId} maxPosts={3} />
                </Dialog>

                <Dialog
                    header="Liked By"
                    visible={likesVisible}
                    style={{ width: '95vw', maxWidth: '450px' }}
                    onHide={() => setLikesVisible(false)}
                    contentClassName="custom-scrollbar"
                >
                    <FollowFollowingList ids={likesIds} />
                </Dialog>
            </div>
        </>
    );
};

export default Feed;
