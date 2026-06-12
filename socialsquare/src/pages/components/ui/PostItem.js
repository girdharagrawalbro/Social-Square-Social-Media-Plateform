import React, { useState, useEffect, useRef } from "react";
import { useInView } from 'react-intersection-observer';
import toast from 'react-hot-toast';

import Like from "./Like";
import Comment from './Comment';
import PostMenu from './PostMenu';
import { ImageCarousel } from "./ImageCarosel";
import { HeartBurst } from "./HeartBurst";
import PollCard from '../PollCard';
import ReactionPicker from '../ReactionPicker';
import ProgressiveImage from './ProgressiveImage';

import formatDate from '../../../utils/formatDate';
import { getMediaThumbnail } from '../../../utils/mediaUtils';
import usePostStore from '../../../store/zustand/usePostStore';
import { usePrefetchUserProfile } from '../../../hooks/queries/useAuthQueries';
import { usePrefetchPost } from '../../../hooks/queries/usePostQueries';
import { useAcceptCollaboration, useDeclineCollaboration } from '../../../hooks/queries/usePostOperationsQueries';

// ─── POST ACTIVITY TRACKER ──────────────────────────────────────────────────
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

// ─── FEED VIDEO ───────────────────────────────────────────────────────────────
const FeedVideo = ({ src, poster, onDoubleClick, onTouchEnd, isLocked }) => {
    const videoRef = useRef(null);
    const isMuted = usePostStore(s => s.isMuted);
    const setIsMuted = usePostStore(s => s.setIsMuted);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showIndicator, setShowIndicator] = useState(null); // 'play' | 'pause' | null
    const indicatorTimer = useRef(null);
    const { ref, inView } = useInView({ threshold: 0.6 });

    useEffect(() => {
        if (!videoRef.current) return;
        if (inView && !isLocked) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [inView, isLocked]);

    const handleClick = (e) => {
        e.stopPropagation();
        if (!videoRef.current || isLocked) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => { });
            setIsPlaying(true);
            flashIndicator('play');
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            flashIndicator('pause');
        }
    };

    const flashIndicator = (type) => {
        setShowIndicator(type);
        clearTimeout(indicatorTimer.current);
        indicatorTimer.current = setTimeout(() => setShowIndicator(null), 800);
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    return (
        <div ref={ref} className="relative w-full bg-black overflow-hidden group" onClick={handleClick}>
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                loop
                muted={isMuted}
                playsInline
                onDoubleClick={onDoubleClick}
                onTouchEnd={onTouchEnd}
                className="w-full h-full object-contain cursor-pointer max-h-[800px]"
            />

            {/* ── Click-to-play/pause centre indicator ───────────── */}
            {showIndicator && (
                <div
                    key={showIndicator}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-150"
                >
                    <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center shadow-xl">
                        <i className={`pi ${showIndicator === 'play' ? 'pi-play' : 'pi-pause'} text-white`} style={{ fontSize: '18px', marginLeft: showIndicator === 'play' ? '3px' : '0' }}></i>
                    </div>
                </div>
            )}

            {/* ── Mute toggle ─────────────────────────────────────── */}
            <button
                onClick={toggleMute}
                className="absolute bottom-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
            >
                <i className={`pi ${isMuted ? 'pi-volume-off' : 'pi-volume-up'}`} style={{ fontSize: '13px' }}></i>
            </button>

            {/* ── Play/Pause state hint (bottom-left, subtle) ──────── */}
            {!isPlaying && !showIndicator && (
                <div className="absolute bottom-2 left-2 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center  pointer-events-none">
                    <i className="pi pi-play text-white" style={{ fontSize: '11px', marginLeft: '2px' }}></i>
                </div>
            )}
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

// ─── FEED MEDIA AREA ──────────────────────────────────────────────────────────
// Handles posts that have video, images, or BOTH.
// When both exist a unified thumbnail strip is shown (video first, then images).
// ──────────────────────────────────────────────────────────────────────────────
const FeedMediaArea = React.memo(({ post, images, hasVideo, hasImages, hasMultiple, locked, heartVisible, onImageDoubleClick, onImageTap, prefetchPost }) => {
    const [activeType] = useState(hasVideo ? 'video' : 'image'); // 'video' | 'image'
    const [activeImageIdx] = useState(0);

    return (
        <div className="relative mx-0 sm:mx-2 rounded-sm overflow-hidden" onMouseEnter={() => prefetchPost(post._id)}>
            {/* ── Main media display ──────────────────────────────── */}
            {activeType === 'video' && hasVideo ? (
                <FeedVideo
                    src={post.video}
                    poster={post.videoThumbnail || getMediaThumbnail(post.video, 'video')}
                    onDoubleClick={() => !locked && onImageDoubleClick(post)}
                    onTouchEnd={() => !locked && onImageTap(post)}
                    isLocked={locked}
                />
            ) : hasImages ? (
                // Images-only mode OR images when video is not active
                hasMultiple && hasVideo ? (
                    // Single image viewer (strip handles navigation)
                    <div
                        onDoubleClick={() => !locked && onImageDoubleClick(post)}
                        style={{ maxHeight: '600px', minHeight: '260px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ProgressiveImage
                            key={images[activeImageIdx]}
                            src={images[activeImageIdx]}
                            alt={`Image ${activeImageIdx + 1}`}
                            objectFit="contain"
                            style={{ maxHeight: '600px', minHeight: '260px' }}
                        />
                    </div>
                ) : (
                    <ImageCarousel
                        images={images}
                        onDoubleClick={() => !locked && onImageDoubleClick(post)}
                        onTouchEnd={() => !locked && onImageTap(post)}
                    />
                )
            ) : null}

            {/* ── Unified thumbnail strip (only when both video + images exist) ── */}
            {/* {hasMultiple && hasVideo && hasImages && (
                <div className="w-full px-2 py-2 bg-black/50 backdrop-blur-md flex gap-2 overflow-x-auto no-scrollbar border-t border-white/10">
                    <button
                        onClick={() => setActiveType('video')}
                        className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 p-0 bg-black relative transition-all cursor-pointer
                            ${activeType === 'video'
                                ? 'border-[#6366f1] opacity-100 scale-105 shadow-md shadow-indigo-500/30'
                                : 'border-transparent opacity-55 hover:opacity-85 hover:scale-105'
                            }`}
                        aria-label="Show video"
                    >
                        <video src={post.video} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <i className="pi pi-play text-white" style={{ fontSize: '11px', marginLeft: '2px' }}></i>
                        </div>
                    </button>
                    {images.map((src, idx) => (
                        <button
                            key={idx}
                            onClick={() => { setActiveType('image'); setActiveImageIdx(idx); }}
                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 p-0 bg-transparent transition-all cursor-pointer
                                ${activeType === 'image' && idx === activeImageIdx
                                    ? 'border-[#6366f1] opacity-100 scale-105 shadow-md shadow-indigo-500/30'
                                    : 'border-transparent opacity-55 hover:opacity-85 hover:scale-105'
                                }`}
                            aria-label={`Show image ${idx + 1}`}
                        >
                            <img src={src} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                    ))}
                </div>
            )} */}

            <HeartBurst visible={heartVisible} />
            {locked && <TimeLockOverlay unlocksAt={post.unlocksAt} />}
        </div>
    );
});

export const PostItem = React.memo(({

    post, user, isLikedByMe, likesCount, isSavedByMe, isFollowing, heartVisible,
    visiblePostId, pickerPostId, savingPostIds,
    onLikeToggle, onImageDoubleClick, onImageTap, onSave, onDelete, onReport,
    onShareToStory, onProfileClick, onSharePost, onEdit,
    setVisibleCommentId, setPickerPostId, handleDwell, handleReact, renderCaption, onFollow,
    onLikesClick, onMute, onBlock
}) => {
    const prefetchUser = usePrefetchUserProfile();
    const prefetchPost = usePrefetchPost();

    const getImages = post => post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    const images = getImages(post);
    const isOwn = !post.isAnonymous && (post.user?._id === user?._id || post.user?._id?.toString() === user?._id);
    const locked = post.unlocksAt && new Date(post.unlocksAt) > Date.now() && !isOwn;
    const expiryRemaining = post.expiresAt ? Math.max(0, new Date(post.expiresAt) - Date.now()) : null;
    const setPostDetailId = usePostStore(s => s.setPostDetailId);

    return (
        <article className="relative overflow-hidden w-full rounded-2xl flex flex-col mb-3 px-0 sm:px-0">
            <PostActivityTracker postId={post._id} onDwell={handleDwell} />
            <CollabInviteBanner post={post} user={user} />

            {/* Header */}
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="relative w-10 h-10 flex-shrink-0"
                        onClick={() => !post.isAnonymous && post.user?._id && onProfileClick(post.user._id)}
                        onMouseEnter={() => !post.isAnonymous && post.user?._id && prefetchUser(post.user._id)}
                    >
                        {post.isAnonymous ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white border border-gray-100 bg-gradient-to-br from-[#808bf5] to-[#ec4899] select-none" style={{ fontSize: '18px' }}>
                                🎭
                            </div>
                        ) : (
                            <div className={`w-10 h-10 rounded-full overflow-hidden cursor-pointer hover:opacity-80 transition border ${post.user?.isOnline ? 'presence-glow' : 'border-gray-100'}`}>
                                <img
                                    src={post.user?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                    alt="Profile"
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <div className="m-0 text-sm leading-none flex items-center gap-1 flex-wrap text-[var(--text-main)] shrink-0">
                                <span
                                    className={`font-bold ${!post.isAnonymous ? 'cursor-pointer hover:text-[#808bf5]' : ''} transition`}
                                    onClick={() => !post.isAnonymous && post.user?._id && onProfileClick(post.user._id)}
                                >
                                    {post.isAnonymous ? 'Anonymous' : (post.user?.fullname || 'Anonymous User')}
                                </span>
                                {!post.isAnonymous && post.collaborators?.filter(c => c.status === 'accepted').length > 0 && (() => {
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
                                {!post.isAnonymous && post.user?.isVerified && <i className="pi pi-check-circle text-blue-500 ml-1" style={{ fontSize: '11px' }}></i>}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-none shrink-0 flex items-center gap-1.5 flex-wrap">
                                {post.isAnonymous && post.category && (
                                    <span className="bg-[#ede9fe] text-[#6366f1] rounded-full px-2 py-0.5 text-[9px] font-bold normal-case select-none">
                                        #{post.category}
                                    </span>
                                )}
                                {post.isAnonymous && post.mood && (
                                    <span className="text-xs select-none">
                                        {({ happy: '😊', sad: '😢', excited: '🤩', angry: '😠', calm: '😌', romantic: '❤️', funny: '😂', inspirational: '💪', nostalgic: '🥹', neutral: '😐' })[post.mood]}
                                    </span>
                                )}
                                {formatDate(post.updatedAt)}
                            </span>

                            {!isOwn && !isFollowing && !post.isAnonymous && (
                                <button
                                    onClick={() => post.user?._id && onFollow(post.user._id)}
                                    className="text-[10px] px-2.5 py-1 rounded-full border border-indigo-500 bg-[#808bf5] text-white cursor-pointer font-semibold transition leading-none h-6 flex items-center"
                                >
                                    Follow
                                </button>
                            )}
                        </div>
                        {post.isAnonymous ? "" : post.location?.name && (
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
                        onMute={() => onMute(post)}
                        onBlock={() => onBlock(post)}
                        isSaving={savingPostIds.has(post._id)}
                    />
                </div>
            </div>

            {/* ── Unified media area: images and/or video ─────────── */}
            {(images.length > 0 || post.video) && (() => {
                const hasVideo = !!post.video;
                const hasImages = images.length > 0;
                const hasMultiple = (hasVideo ? 1 : 0) + images.length > 1;

                // State for which media item is active lives in a small wrapper
                return (
                    <FeedMediaArea
                        post={post}
                        images={images}
                        hasVideo={hasVideo}
                        hasImages={hasImages}
                        hasMultiple={hasMultiple}
                        locked={locked}
                        heartVisible={heartVisible}
                        onImageDoubleClick={onImageDoubleClick}
                        onImageTap={onImageTap}
                        prefetchPost={prefetchPost}
                    />
                );
            })()}

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
                <div className="text-[var(--text-main)] w-full p-3">
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
                        <div className="m-0 mt-1 text-sm leading-relaxed">
                            <span
                                className={`font-semibold mr-1 ${!post.isAnonymous ? 'cursor-pointer hover:text-indigo-600' : ''} transition`}
                                onClick={() => !post.isAnonymous && post.user?._id && onProfileClick(post.user._id)}
                            >
                                {post.isAnonymous ? 'Anonymous' : (post.user?.username || post.user?.fullname || 'Unknown')}
                            </span>
                            {renderCaption(post.caption || '', post._id)}
                        </div>
                        {post.isCollaborative && post.collaborators?.filter(c => c.status === 'accepted').map((c, i) => (
                            <div key={i} className="m-0 mt-0.5 text-sm leading-relaxed">
                                <span
                                    className="font-semibold mr-1 cursor-pointer hover:text-indigo-600 transition"
                                    onClick={() => onProfileClick(c.userId)}
                                >
                                    {c.username || c.fullname}
                                </span>
                                {renderCaption(c.contribution || '')}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {visiblePostId === post._id && <Comment postId={post._id} setVisible={() => setVisibleCommentId(null)} onProfileClick={onProfileClick} />}
        </article>
    );
});