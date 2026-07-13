import React, { useState, useEffect, useRef } from "react";
import { useInView } from 'react-intersection-observer';
import toast from '../../../utils/toast.js';
import { importSymmetricKey, decryptFile } from '../../../utils/cryptoUtils';
import dbService from '../../../utils/indexedDb';

import Comment from './Comment';
import PostMenu from './PostMenu';
import { ImageCarousel } from "./ImageCarosel";
import { HeartBurst } from "./HeartBurst";
import PollCard from '../PollCard';
import ReactionPicker from '../ReactionPicker';
import ProgressiveImage from './ProgressiveImage';
import SaveCollectionModal from '../SaveCollectionModal';

import formatDate from '../../../utils/formatDate';
import { getMediaThumbnail } from '../../../utils/mediaUtils';
import usePostStore from '../../../store/zustand/usePostStore';
import { usePrefetchUserProfile } from '../../../hooks/queries/useAuthQueries';
import { usePrefetchPost } from '../../../hooks/queries/usePostQueries';
import { useAcceptCollaboration, useDeclineCollaboration } from '../../../hooks/queries/usePostOperationsQueries';
import { USER_DEFAULT_IMAGE } from "../../../utils/constantMediaVariable";

const decryptionCache = new Map(); // url -> localBlobUrl

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

// ─── AI DWELL POPUP ────────────────────────────────────────────────────────────
// Renders OUTSIDE the feed card as a floating chip above the post
const AiDwellPopup = ({ post, forceShowToken }) => {
    const { ref: inViewRef, inView } = useInView({ threshold: 0.2 });
    const [visible, setVisible] = useState(false);
    const [screenType, setScreenType] = useState('desktop'); // 'desktop' | 'tablet' | 'phone'
    const [isLoading, setIsLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setScreenType('phone');
            } else if (width < 1024) {
                setScreenType('tablet');
            } else {
                setScreenType('desktop');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (forceShowToken > 0) {
            setVisible(true);
            setIsLoading(false);
            setDismissed(false);
        }
    }, [forceShowToken]);

    useEffect(() => {
        let hideTimer;
        if (visible && !isLoading && screenType !== 'desktop') {
            hideTimer = setTimeout(() => {
                setVisible(false);
            }, 5000);
        }
        return () => clearTimeout(hideTimer);
    }, [visible, isLoading, screenType]);

    useEffect(() => {
        let showTimer;
        let loadTimer;
        if (inView && post.aiSummary && !dismissed) {
            // Show the popup with loading skeleton after 1 second
            showTimer = setTimeout(() => {
                setVisible(true);
                setIsLoading(true);

                // Finish loading after another 1.8 seconds (2.8 seconds total dwell)
                loadTimer = setTimeout(() => {
                    setIsLoading(false);
                }, 1000);
            }, 500);
        } else {
            setVisible(false);
            setIsLoading(true);
        }
        return () => {
            clearTimeout(showTimer);
            clearTimeout(loadTimer);
        };
    }, [inView, post.aiSummary, dismissed]);

    if (!post.aiSummary) return <div ref={inViewRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', pointerEvents: 'none' }} />;

    // Responsive positioning logic
    const getPositionStyles = () => {
        const base = {
            position: 'absolute',
            zIndex: 50,
            pointerEvents: 'auto',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '14px 16px',
            animation: 'aiPopupIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
            transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
            overflow: 'hidden',
            width: 'calc(100% - 32px)',
            maxWidth: '340px', borderRadius: '18px',

        };

        if (screenType === 'phone') {
            return {
                ...base,
                bottom: 'auto',
                top: '64px',
                left: '50%',
                transform: 'translateX(-50%)',
                border: '1px solid var(--border-color)',
                borderRadius: '18px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                background: 'var(--surface-2)',
                backdropFilter: 'blur(20px)',
            };
        } else {
            return {
                ...base,
                top: '9%',
                bottom: 'auto',
                left: screenType === 'tablet' || '140%',
                transform: 'translateX(-50%)',
                background: 'var(--surface-2)',
                borderRadius: '18px',
            };
        }
    };

    return (
        <>
            {/* Invisible sentinel — tracks when this post enters the viewport */}
            <div ref={inViewRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', pointerEvents: 'none' }} />

            {visible && (
                <div style={getPositionStyles()}>
                    {/* Top row: sparkle icon + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                background: 'linear-gradient(135deg,rgba(128,139,245,0.25),rgba(192,132,252,0.25))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 10px rgba(128,139,245,0.15)',
                                animation: isLoading ? 'pulseScale 1.5s infinite ease-in-out' : 'none'
                            }}>
                                <i className="pi pi-sparkles" style={{ color: '#808bf5', fontSize: '11px' }}></i>
                            </div>
                            <span style={{
                                fontWeight: 800,
                                fontSize: '9px',
                                color: '#808bf5',
                                textTransform: 'uppercase',
                                letterSpacing: '0.14em',
                                opacity: isLoading ? 0.6 : 1,
                                transition: 'opacity 0.3s ease'
                            }}>
                                {isLoading ? 'Thinking...' : 'AI Insight'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {/* <button
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: '3px 6px', lineHeight: 1 }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="More options"
                            >
                                <i className="pi pi-ellipsis-v" style={{ fontSize: '12px' }}></i>
                            </button> */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setVisible(false); setDismissed(true); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: '3px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                                aria-label="Dismiss AI insight"
                            >
                                <i className="pi pi-times" style={{ fontSize: '11px' }}></i>
                            </button>
                        </div>
                    </div>

                    {/* Content Section */}
                    {isLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '4px' }}>
                            <div
                                className="skeleton-bar"
                                style={{
                                    height: '10px',
                                    width: '100%',
                                    borderRadius: '5px',
                                    background: 'linear-gradient(90deg, var(--surface-3) 0%, var(--border-color) 50%, var(--surface-3) 100%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'pulseGlow 1.5s infinite linear'
                                }}
                            />
                            <div
                                className="skeleton-bar"
                                style={{
                                    height: '10px',
                                    width: '85%',
                                    borderRadius: '5px',
                                    background: 'linear-gradient(90deg, var(--surface-3) 0%, var(--border-color) 50%, var(--surface-3) 100%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'pulseGlow 1.5s infinite linear 0.2s'
                                }}
                            />
                            <div
                                className="skeleton-bar"
                                style={{
                                    height: '10px',
                                    width: '60%',
                                    borderRadius: '5px',
                                    background: 'linear-gradient(90deg, var(--surface-3) 0%, var(--border-color) 50%, var(--surface-3) 100%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'pulseGlow 1.5s infinite linear 0.4s'
                                }}
                            />
                        </div>
                    ) : (
                        /* Summary text with typewriter/writing reveal effect */
                        <p style={{
                            margin: 0,
                            fontSize: '13px',
                            lineHeight: '1.6',
                            fontWeight: 500,
                            color: 'var(--text-main)',
                            animation: 'writeReveal 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                            display: 'inline-block'
                        }}>
                            {post.aiSummary}
                        </p>
                    )}
                </div>
            )}
        </>
    );
};


// ─── FEED VIDEO ───────────────────────────────────────────────────────────────
export const FeedVideo = ({ src, poster, onDoubleClick, onTouchEnd, isLocked, fileKey, iv }) => {
    const videoRef = useRef(null);
    const isMuted = usePostStore(s => s.isMuted);
    const setIsMuted = usePostStore(s => s.setIsMuted);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showIndicator, setShowIndicator] = useState(null); // 'play' | 'pause' | null
    const indicatorTimer = useRef(null);
    const { ref, inView } = useInView({ threshold: 0.6 });

    const [videoSrc, setVideoSrc] = useState(src);
    const [isDecrypting, setIsDecrypting] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (!fileKey || !iv) {
            setVideoSrc(src);
            return;
        }

        if (decryptionCache.has(src)) {
            setVideoSrc(decryptionCache.get(src));
            return;
        }

        let active = true;
        let localBlobUrl = null;
        setIsDecrypting(true);

        const decrypt = async () => {
            try {
                const cachedBlob = await dbService.getMedia(src);
                if (cachedBlob) {
                    localBlobUrl = URL.createObjectURL(cachedBlob);
                    decryptionCache.set(src, localBlobUrl);
                    if (active) {
                        setVideoSrc(localBlobUrl);
                        setIsDecrypting(false);
                    }
                } else {
                    const response = await fetch(src);
                    const arrayBuffer = await response.arrayBuffer();
                    const cryptoKey = await importSymmetricKey(fileKey);
                    const decryptedBuffer = await decryptFile(arrayBuffer, iv, cryptoKey);
                    const blob = new Blob([decryptedBuffer], { type: 'video/mp4' });

                    await dbService.setMedia(src, blob);

                    localBlobUrl = URL.createObjectURL(blob);
                    decryptionCache.set(src, localBlobUrl);
                    if (active) {
                        setVideoSrc(localBlobUrl);
                        setIsDecrypting(false);
                    }
                }
            } catch (err) {
                console.error("Failed to decrypt video:", err);
                if (active) setIsDecrypting(false);
            }
        };
        decrypt();
        return () => {
            active = false;
            if (localBlobUrl && !decryptionCache.has(src)) {
                URL.revokeObjectURL(localBlobUrl);
            }
        };
    }, [src, fileKey, iv]);

    useEffect(() => {
        if (!videoRef.current) return;
        if (inView && !isLocked && !isDecrypting) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [inView, isLocked, isDecrypting, videoSrc]);

    const handleClick = (e) => {
        e.stopPropagation();
        if (!videoRef.current || isLocked || isDecrypting) return;
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
            {isDecrypting ? (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    <i className="pi pi-spin pi-spinner text-[#808bf5]" style={{ fontSize: '24px' }} />
                </div>
            ) : (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    poster={poster}
                    loop
                    muted={isMuted}
                    playsInline
                    onDoubleClick={onDoubleClick}
                    onTouchEnd={onTouchEnd}
                    className="w-full h-full object-contain cursor-pointer max-h-[800px]"
                    onCanPlay={() => {
                        // When the video first mounts after decryption, the useEffect
                        // fires before videoRef is attached. onCanPlay guarantees we
                        // attempt play once the element is ready and in view.
                        if (inView && !isLocked && videoRef.current?.paused) {
                            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
                        }
                    }}
                />
            )}

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
            {!isPlaying && !showIndicator && !isDecrypting && (
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

// ─── BEFORE / AFTER VIEW ─────────────────────────────────────────────────────
export const BeforeAfterView = ({ post, beforeAfter, onImageDoubleClick, onImageTap, locked, heartVisible }) => {
    const containerRef = useRef(null);
    const [sliderPos, setSliderPos] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    const handlePointerDown = (e) => {
        if (locked) return;
        e.preventDefault();
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        updateSliderPosition(e);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        updateSliderPosition(e);
    };

    const handlePointerUp = (e) => {
        setIsDragging(false);
    };

    const updateSliderPosition = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPos(percentage);
    };

    const { type, beforeUrl, afterUrl, beforeLabel = 'Before', afterLabel = 'After', beforeText, afterText } = beforeAfter;

    if (type === 'image') {
        return (
            <div className="relative mx-0 sm:mx-2 rounded-xl overflow-hidden select-none bg-black border border-white/10 shadow-lg">
                <div
                    ref={containerRef}
                    className="relative w-full aspect-square sm:aspect-[4/3] cursor-ew-resize overflow-hidden group touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onDoubleClick={() => !locked && onImageDoubleClick && onImageDoubleClick(post)}
                    onTouchEnd={() => !locked && onImageTap && onImageTap(post)}
                >
                    {/* Before Image (underneath/left) */}
                    <div className="absolute inset-0 w-full h-full">
                        <ProgressiveImage
                            src={beforeUrl}
                            alt={beforeLabel}
                            className="w-full h-full object-cover pointer-events-none select-none"
                            fileKey={post.beforeImageKey}
                            iv={post.beforeImageIv}
                        />
                    </div>

                    {/* After Image (clipped on top/right) */}
                    <div
                        className="absolute inset-0 w-full h-full"
                        style={{
                            clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`
                        }}
                    >
                        <ProgressiveImage
                            src={afterUrl}
                            alt={afterLabel}
                            className="w-full h-full object-cover pointer-events-none select-none"
                            fileKey={post.afterImageKey}
                            iv={post.afterImageIv}
                        />
                    </div>

                    {/* Labels overlay */}
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20 select-none pointer-events-none">
                        {beforeLabel}
                    </div>
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20 select-none pointer-events-none">
                        {afterLabel}
                    </div>

                    {/* Draggable Divider line */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl pointer-events-none"
                        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
                    >
                        {/* Divider knob */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-gray-800 shadow-2xl flex items-center justify-center border border-white/50 cursor-ew-resize hover:scale-110 active:scale-95 transition-all">
                            <i className="pi pi-arrows-h text-sm"></i>
                        </div>
                    </div>

                    {/* Double-tap Heart Burst for likes */}
                    <HeartBurst visible={heartVisible} />
                    {locked && <TimeLockOverlay unlocksAt={post.unlocksAt} />}
                </div>
            </div>
        );
    }

    if (type === 'code') {
        return (
            <div className="mx-0 sm:mx-2 bg-[#1a1b26] rounded-xl border border-white/10 shadow-lg overflow-hidden flex flex-col font-mono text-sm">
                {/* Terminal Mac-style header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#16161e] border-b border-white/5">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                        <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                        <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
                    </div>
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Code Comparison</span>
                    <div className="w-12" /> {/* spacer */}
                </div>

                {/* Compare Panes */}
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/5 bg-[#1a1b26]">
                    {/* Left Pane - Before */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="px-4 py-1.5 bg-[#e05f65]/10 border-b border-white/5 flex items-center justify-between">
                            <span className="text-xs font-bold text-[#e05f65] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#e05f65]" />
                                {beforeLabel}
                            </span>
                        </div>
                        <div className="p-4 overflow-x-auto max-h-[350px] custom-scrollbar text-[#a9b1d6]">
                            <pre className="whitespace-pre text-xs leading-relaxed">
                                <code>{beforeText || '// Empty'}</code>
                            </pre>
                        </div>
                    </div>

                    {/* Right Pane - After */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="px-4 py-1.5 bg-[#39c5bb]/10 border-b border-white/5 flex items-center justify-between">
                            <span className="text-xs font-bold text-[#39c5bb] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#39c5bb]" />
                                {afterLabel}
                            </span>
                        </div>
                        <div className="p-4 overflow-x-auto max-h-[350px] custom-scrollbar text-[#a9b1d6]">
                            <pre className="whitespace-pre text-xs leading-relaxed">
                                <code>{afterText || '// Empty'}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'text') {
        return (
            <div className="mx-0 sm:mx-2 bg-[var(--surface-2)] rounded-xl border border-white/10 shadow-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 bg-[var(--surface-3)] border-b border-white/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Text Revision</span>
                    <i className="pi pi-file-edit text-xs text-[var(--text-sub)]"></i>
                </div>

                {/* Compare Content */}
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/5">
                    {/* Left Pane - Before */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="px-4 py-2 bg-red-500/5 border-b border-white/5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-red-500">{beforeLabel}</span>
                        </div>
                        <div className="p-4 text-sm text-[var(--text-sub)] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                            {beforeText || 'No text content'}
                        </div>
                    </div>

                    {/* Right Pane - After */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="px-4 py-2 bg-emerald-500/5 border-b border-white/5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-500">{afterLabel}</span>
                        </div>
                        <div className="p-4 text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto font-medium">
                            {afterText || 'No text content'}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

// ─── FEED MEDIA AREA ──────────────────────────────────────────────────────────
// Handles posts that have video, images, or BOTH.
// When both exist a unified thumbnail strip is shown (video first, then images).
// ──────────────────────────────────────────────────────────────────────────────
const FeedMediaArea = React.memo(({ post, images, hasVideo, hasImages, hasMultiple, locked, heartVisible, onImageDoubleClick, onImageTap, prefetchPost, onProfileClick }) => {
    const [activeType] = useState(hasVideo ? 'video' : 'image'); // 'video' | 'image'
    const [activeImageIdx] = useState(0);
    const [showTags, setShowTags] = useState(false);
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
                    fileKey={post.videoKey}
                    iv={post.videoIv}
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
                            fileKey={post.mediaKeys?.[activeImageIdx]?.key}
                            iv={post.mediaKeys?.[activeImageIdx]?.iv}
                        />
                    </div>
                ) : (
                    <ImageCarousel
                        images={images}
                        mediaKeys={post.mediaKeys}
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

            {/* Tagged/Mentioned Users Overlay on Image */}
            {showTags && post.mentions && post.mentions.length > 0 && (
                <div className="absolute bottom-14 left-3 z-30 bg-black/85 backdrop-blur-md border border-white/20 p-2.5 rounded-xl flex flex-col gap-1.5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {post.mentions.map((m, idx) => {
                        const uid = typeof m === 'object' ? m._id : m;
                        const name = typeof m === 'object' ? (m.username || m.fullname) : 'user';
                        if (!uid) return null;
                        return (
                            <span
                                key={uid}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onProfileClick) onProfileClick(uid);
                                }}
                                className="text-xs font-semibold text-white hover:text-[#808bf5] cursor-pointer flex items-center gap-1.5 transition-colors"
                            >
                                @{name}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Human Icon Trigger Button - MOBILE */}
            {post.mentions && post.mentions.length > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); setShowTags(prev => !prev); }}
                    className={`absolute bottom-3 left-3 z-30 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center cursor-pointer transition-all shadow-md active:scale-90 ${showTags ? 'bg-[#808bf5] text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
                    title="Show Tagged Users"
                >

                    <i className="pi pi-user" style={{ fontSize: '12px' }}></i>
                </button>
            )}
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
    const [collectionModalVisible, setCollectionModalVisible] = useState(false);
    const [forceShowToken, setForceShowToken] = useState(0);
    return (
        <div style={{ position: 'relative' }}>
            {/* AI Insight floats OUTSIDE the card, above it */}
            <AiDwellPopup post={post} forceShowToken={forceShowToken} />

            <style>{`
                @keyframes aiPopupIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.96); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1);    }
                }
                @keyframes pulseGlow {
                    0% { background-position: 100% 0%; }
                    100% { background-position: -100% 0%; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pulseScale {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.12); opacity: 1; }
                }
                @keyframes writeReveal {
                    from {
                        clip-path: polygon(0 0, 0 0, 0 100%, 0% 100%);
                        opacity: 0.1;
                    }
                    to {
                        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
                        opacity: 1;
                    }
                }
            `}</style>

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
                                <div className={`w-10 h-10 rounded-full overflow-hidden cursor-pointer hover:opacity-80 transition border ${post.visibility === 'close_friends' ? 'border-2 border-green-500 p-[1px]' : (post.user?.isOnline ? 'presence-glow' : 'border-gray-100')}`}>
                                    <img
                                        src={post.user?.profile_picture || USER_DEFAULT_IMAGE}
                                        alt="Profile"
                                        loading="lazy"
                                        className="w-full h-full object-cover rounded-full"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <div className="m-0 text-sm leading-none flex items-center gap-1 flex-wrap text-[var(--text-main)] shrink-0">
                                    <span
                                        className={`font-bold ${!post.isAnonymous ? 'cursor-pointer hover:text-[#808bf5]' : ''} transition flex items-center gap-1`}
                                        onClick={() => !post.isAnonymous && post.user?._id && onProfileClick(post.user._id)}
                                    >
                                        {post.isAnonymous ? 'Anonymous' : (post.user?.fullname || 'Anonymous User')}
                                        {post.visibility === 'close_friends' && (
                                            <span className="bg-green-500 text-white rounded-full w-3 h-3 flex items-center justify-center ml-0.5" title="Close Friends">
                                                <i className="pi pi-star-fill text-[6px]"></i>
                                            </span>
                                        )}
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
                            {post.goalId && (
                                <div
                                    onClick={() => {
                                        if (post.user?._id) {
                                            onProfileClick(post.user._id);
                                            sessionStorage.setItem('profileActiveTab', 'goals');
                                        }
                                    }}
                                    className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-500/20 cursor-pointer mt-1 self-start transition-all"
                                >
                                    🎯 Tracking Goal: {post.goalId.title} ({post.goalId.progress}%)
                                </div>
                            )}
                            {post.isAnonymous ? "" : post.location?.name && (
                                <div className="flex items-center gap-1 mt-1">
                                    <i className="pi pi-map-marker text-[9px] text-gray-400"></i>
                                    <span className="text-[10px] text-gray-400 font-medium">{post.location.name}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {post.readingTime > 0 && (
                                    <span className="inline-flex items-center gap-1 bg-indigo-500/5 text-[#808bf5] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-500/10 select-none">
                                        📖 {post.readingTime} min read
                                    </span>
                                )}
                                {post.depthScore && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border select-none ${post.depthScore === 'quick_take' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                        post.depthScore === 'deep_dive' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                            'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                        }`}>
                                        {post.depthScore === 'quick_take' ? '⚡ Quick Take' :
                                            post.depthScore === 'deep_dive' ? '🧠 Deep Dive' :
                                                '📚 Long Read'}
                                    </span>
                                )}
                            </div>
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

                {post.isFeedbackRequest && (
                    <div className="mx-4 my-2.5 p-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] shrink-0">
                                <i className="pi pi-comments text-sm"></i>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-main)]">Critique Requested</span>
                                <span className="text-[9px] text-[var(--text-sub)]">The author is asking for constructive critiques instead of likes.</span>
                            </div>
                        </div>
                        <span className="bg-[#6366f1] text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm shrink-0">
                            {post.feedbackCategory || 'General'}
                        </span>
                    </div>
                )}

                {/* Before / After Post Format */}
                {post.isBeforeAfter && post.beforeAfter && (
                    <BeforeAfterView
                        post={post}
                        beforeAfter={post.beforeAfter}
                        onImageDoubleClick={onImageDoubleClick}
                        onImageTap={onImageTap}
                        locked={locked}
                        heartVisible={heartVisible}
                    />
                )}

                {/* ── Unified media area: images and/or video ─────────── */}
                {!post.isBeforeAfter && (images.length > 0 || post.video) && (() => {
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
                            onProfileClick={onProfileClick}
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
                                {!post.isFeedbackRequest && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); onLikeToggle(post); }}
                                        className="flex items-center gap-1 cursor-pointer"
                                    >
                                        <i
                                            className={`pi ${isLikedByMe ? 'pi-heart-fill' : 'pi-heart'}`}
                                            style={{ fontSize: '1.2rem', color: isLikedByMe ? '#ef4444' : 'currentColor' }}
                                        ></i>
                                        {likesCount > 0 && (
                                            <span
                                                onClick={(e) => { e.stopPropagation(); onLikesClick && onLikesClick(post.likes); }}
                                                className="text-xs font-bold hover:underline"
                                            >
                                                {likesCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {!post.isFeedbackRequest ? (() => {
                                    const myReaction = post.reactions?.find(r => r.emoji !== '❤️' && (r.userId === user?._id || r.userId?.toString() === user?._id?.toString()));
                                    const reactionGroups = (post.reactions || []).reduce((acc, r) => {
                                        if (r.emoji !== '❤️') {
                                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                        }
                                        return acc;
                                    }, {});

                                    return (
                                        <div
                                            className="relative flex items-center gap-2 cursor-pointer"
                                            onMouseEnter={() => !window.matchMedia('(pointer: coarse)').matches && setPickerPostId(post._id)}
                                            onMouseLeave={() => setPickerPostId(null)}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.matchMedia('(pointer: coarse)').matches) {
                                                        setPickerPostId(p => p === post._id ? null : post._id);
                                                    } else {
                                                        if (myReaction) {
                                                            handleReact(post, myReaction.emoji);
                                                        } else {
                                                            handleReact(post, '💡');
                                                        }
                                                    }
                                                }}
                                                className="cursor-pointer flex items-center justify-center w-7 h-7 text-[var(--text-main)] hover:text-[#808bf5] transition-all"
                                                title={myReaction ? `Reacted with ${myReaction.emoji}` : "React to post"}
                                            >
                                                {myReaction ? (
                                                    <span className="text-base select-none leading-none animate-bounce-short">{myReaction.emoji}</span>
                                                ) : (
                                                    <i className="pi pi-star text-[1.2rem] opacity-75 hover:opacity-100 hover:scale-110 transition-transform"></i>
                                                )}
                                            </div>

                                            {pickerPostId === post._id && (
                                                <ReactionPicker
                                                    onSelect={(emoji) => handleReact(post, emoji)}
                                                    onClose={() => setPickerPostId(null)}
                                                />
                                            )}

                                            {/* Reaction breakdown pills */}
                                            {Object.keys(reactionGroups).length > 0 && (
                                                <div className="flex gap-1.5 flex-wrap items-center">
                                                    {Object.entries(reactionGroups).map(([emoji, count]) => (
                                                        <span
                                                            key={emoji}
                                                            onClick={(e) => { e.stopPropagation(); handleReact(post, emoji); }}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer hover:scale-105 active:scale-95 ${myReaction?.emoji === emoji ? 'bg-indigo-500/10 border-indigo-500/30 text-[#808bf5]' : 'bg-[var(--surface-2)] border-[var(--border-color)] text-[var(--text-sub)]'}`}
                                                        >
                                                            <span>{emoji}</span>
                                                            <span>{count}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })() : (
                                    <div className="flex items-center gap-1.5 text-[#6366f1] bg-[#6366f1]/10 px-2.5 py-1 rounded-full border border-[#6366f1]/20 select-none">
                                        <i className="pi pi-comments text-xs"></i>
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider">Critique Mode</span>
                                    </div>
                                )}
                                <button aria-label={visiblePostId === post._id ? "Close comments" : "Open comments"} onClick={(e) => { e.stopPropagation(); setVisibleCommentId(p => p === post._id ? null : post._id); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)] gap-2">
                                    <i className="pi pi-comment" style={{ fontSize: '1.2rem' }}></i> {post.comments?.length || 0}
                                </button>
                                <button aria-label="Share post" onClick={(e) => { e.stopPropagation(); onSharePost(post); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)]">
                                    <i className="pi pi-send" style={{ fontSize: '1.15rem' }}></i>
                                </button>
                                {post.aiSummary && (
                                    <button aria-label="Show AI insight" onClick={(e) => { e.stopPropagation(); setForceShowToken(prev => prev + 1); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)]" title="Show AI Insight">
                                        <i className="pi pi-sparkles" style={{ fontSize: '1.15rem', color: '#808bf5' }}></i>
                                    </button>
                                )}
                                <button aria-label="View post details" onClick={(e) => { e.stopPropagation(); setPostDetailId(post._id); }} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-[var(--text-main)] ml-auto" style={{ marginRight: '4px' }}>
                                    <i className="pi pi-external-link" style={{ fontSize: '1rem' }}></i>
                                </button>
                                <button aria-label={isSavedByMe ? 'Unsave post' : 'Save post'} onClick={(e) => { e.stopPropagation(); onSave(post); if (!isSavedByMe) setCollectionModalVisible(true); }} disabled={savingPostIds.has(post._id)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0" style={{ opacity: savingPostIds.has(post._id) ? 0.5 : 1, pointerEvents: savingPostIds.has(post._id) ? 'none' : 'auto' }}>
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
                            {post.mentions && post.mentions.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                    <span className="text-[11px] text-[var(--text-sub)] font-medium">Tagged:</span>
                                    {post.mentions.map((m, idx) => {
                                        const uid = typeof m === 'object' ? m._id : m;
                                        const name = typeof m === 'object' ? (m.username || m.fullname) : 'user';
                                        if (!uid) return null;
                                        return (
                                            <span
                                                key={uid}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onProfileClick(uid);
                                                }}
                                                className="inline-flex items-center gap-1 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            >
                                                @{name}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
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

                {visiblePostId === post._id && <Comment postId={post._id} post={post} setVisible={() => setVisibleCommentId(null)} onProfileClick={onProfileClick} />}
            </article>

            <SaveCollectionModal
                post={post}
                visible={collectionModalVisible}
                onHide={() => setCollectionModalVisible(false)}
            />
        </div>
    );
});