import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/zustand/useAuthStore';
import usePostStore from '../store/zustand/usePostStore';
import { useFeed, useLikePost } from '../hooks/queries/usePostQueries';
import SharePostDialog from './components/ui/SharePostDialog';
import Comment from './components/ui/Comment';
import Like from './components/ui/Like';

const FALLBACK_REELS = [
    {
        _id: 'sample-reel-1',
        video: '/mp_.mp4',
        caption: 'A quick Social Square reel preview.',
        category: 'Social Square',
        user: {
            _id: 'social-square',
            fullname: 'Social Square',
            username: 'socialsquare',
            profile_picture: '/logo.jpg',
        },
        likes: [],
        comments: [],
    },
];

const formatCount = (count = 0) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
};

const ReelsVideo = ({ post, active, muted, onToggleMute, onDoubleTap, onOpenComments }) => {
    const videoRef = useRef(null);
    const lastTapRef = useRef(0);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (active) {
            video.currentTime = video.currentTime || 0;
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [active]);

    useEffect(() => {
        if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);

    const handleTap = () => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            onDoubleTap(post);
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
    };

    return (
        <button
            type="button"
            onClick={handleTap}
            onKeyDown={(e) => {
                if (e.key === 'Enter') onOpenComments(post._id);
                if (e.key === ' ') {
                    e.preventDefault();
                    onToggleMute();
                }
            }}
            className="absolute inset-0 border-0 bg-black p-0 cursor-pointer text-left"
            aria-label="Play reel"
        >
            <video
                ref={videoRef}
                src={post.video}
                className="w-full h-full object-cover"
                loop
                muted={muted}
                playsInline
                preload="metadata"
            />
        </button>
    );
};

const ActionButton = ({ icon, label, count, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-10 h-10 border-0 bg-transparent text-white cursor-pointer flex flex-col items-center justify-center gap-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
        aria-label={label}
    >
        <span className={`w-11 h-11 flex items-center justify-center transition-all ${active ? 'text-red-500 scale-110' : 'text-white hover:scale-110'}`}>
            <i className={`pi ${icon} text-2xl`} />
        </span>
        {count !== undefined && <span className="text-[11px] font-bold leading-none">{formatCount(count)}</span>}
    </button>
);

const Reels = () => {
    const user = useAuthStore(s => s.user);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);
    const setProfileDetailId = usePostStore(s => s.setProfileDetailId);
    const feedQuery = useFeed(user?._id);
    const likeMutation = useLikePost();

    const [activeIndex, setActiveIndex] = useState(0);
    const [muted, setMuted] = useState(true);
    const [heartBurstId, setHeartBurstId] = useState(null);
    const [sharePost, setSharePost] = useState(null);
    const [commentPost, setCommentPost] = useState(null);
    const itemRefs = useRef([]);

    const videoPosts = useMemo(() => {
        const posts = feedQuery.data?.pages?.flatMap(page => page.posts || []) || [];
        const reels = posts.filter(post => !!post.video);
        return reels.length ? reels : FALLBACK_REELS;
    }, [feedQuery.data]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (visible?.target?.dataset?.index) {
                    setActiveIndex(Number(visible.target.dataset.index));
                }
            },
            { threshold: [0.55, 0.75, 0.9] }
        );

        itemRefs.current.forEach(node => {
            if (node) observer.observe(node);
        });

        return () => observer.disconnect();
    }, [videoPosts.length]);

    const isLikedByMe = useCallback((post) => {
        const optimisticSet = optimisticLikes[post._id];
        if (optimisticSet) {
            return Array.from(optimisticSet).some(id => id?.toString() === user?._id?.toString());
        }
        return (post.likes || []).some(id => id?.toString() === user?._id?.toString());
    }, [optimisticLikes, user?._id]);

    const likesCount = useCallback((post) => {
        const optimisticSet = optimisticLikes[post._id];
        return optimisticSet ? optimisticSet.size : (post.likes?.length || 0);
    }, [optimisticLikes]);

    const toggleLike = useCallback((post) => {
        if (post._id?.startsWith('sample-reel')) {
            setHeartBurstId(post._id);
            setTimeout(() => setHeartBurstId(null), 850);
            return;
        }

        const liked = isLikedByMe(post);
        likeMutation.mutate({ postId: post._id, isLiked: liked, likes: post.likes || [] });
    }, [isLikedByMe, likeMutation]);

    const handleDoubleTap = useCallback((post) => {
        if (navigator.vibrate) navigator.vibrate([10, 30]);
        if (!isLikedByMe(post)) toggleLike(post);
        setHeartBurstId(post._id);
        setTimeout(() => setHeartBurstId(null), 850);
    }, [isLikedByMe, toggleLike]);

    const copyAudio = useCallback((post) => {
        const track = post.audioTrack || post.music || post.category || 'Original audio';
        navigator.clipboard?.writeText(track).then(
            () => toast.success('Audio track copied'),
            () => toast(track)
        );
    }, []);

    return (
        <div className="h-full w-full bg-black text-white overflow-hidden md:flex md:items-center md:justify-center">
            <div className="relative h-full w-full bg-black overflow-hidden md:max-w-[430px] md:border-x md:border-white/10 md:shadow-[0_0_60px_rgba(0,0,0,0.55)]">
                <div className="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain custom-scrollbar">
                    {videoPosts.map((post, index) => {
                        const liked = isLikedByMe(post);
                        const count = likesCount(post);
                        const author = post.user || {};
                        const commentsCount = post.commentsCount ?? post.comments?.length ?? 0;

                        return (
                            <section
                                key={post._id || index}
                                ref={node => { itemRefs.current[index] = node; }}
                                data-index={index}
                                className="relative h-full min-h-full snap-start snap-always bg-black overflow-hidden"
                            >
                                <ReelsVideo
                                    post={post}
                                    active={activeIndex === index}
                                    muted={muted}
                                    onToggleMute={() => setMuted(value => !value)}
                                    onDoubleTap={handleDoubleTap}
                                    onOpenComments={() => setCommentPost(post)}
                                />

                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/35 via-transparent to-black/75" />

                                {heartBurstId === post._id && (
                                    <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                        <i className="pi pi-heart-fill text-red-500 text-8xl reels-heart-burst drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]" />
                                    </div>
                                )}

                                <div className="absolute right-2 bottom-[calc(12px+env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-6">
                                    <button
                                        type="button"
                                        onClick={() => toggleLike(post)}
                                        className="w-10 h-10 border-0 bg-transparent text-white cursor-pointer flex flex-col items-center justify-center gap-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
                                        aria-label={liked ? 'Unlike reel' : 'Like reel'}
                                    >
                                        <span className="w-11 h-11 flex items-center justify-center transition-all hover:scale-110">
                                            <Like id={`like-${post._id}`} isliked={liked} />
                                        </span>
                                        {count !== undefined && <span className="text-[11px] font-bold leading-none">{formatCount(count)}</span>}
                                    </button>
                                    <ActionButton icon="pi-comment" label="Comment" count={commentsCount} onClick={() => setCommentPost(post)} />
                                    <ActionButton icon="pi-send" label="Share" onClick={() => setSharePost(post)} />
                                    {/* <ActionButton icon="pi-audio" label="Audio track" onClick={() => copyAudio(post)} /> */}
                                    <ActionButton icon={`${muted ? 'pi-volume-off' : 'pi-volume-up'}`} label={`${muted ? 'Unmute' : 'Mute'}`} onClick={() => setMuted(value => !value)} />
                                </div>

                                <div className="absolute left-3 right-24 bottom-[calc(10px+env(safe-area-inset-bottom))] z-20">
                                    <div className="flex items-center gap-3 mb-2">
                                        <img
                                            src={author.profile_picture || '/logo.jpg'}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover border border-white/30"
                                        />
                                        <div className="min-w-0">
                                            <p className="m-0 text-sm font-black truncate">{author.fullname || author.username || 'Creator'}</p>
                                            <p className="m-0 text-[11px] text-white/70 truncate">@{author.username || 'socialsquare'}</p>
                                        </div>
                                    </div>
                                    {post.caption && <p className="m-0 text-sm leading-snug line-clamp-2">{post.caption}</p>}
                                    <button
                                        type="button"
                                        onClick={() => copyAudio(post)}
                                        className="mt-1 max-w-full border-0 rounded-full bg-white/12 text-white px-3 py-2 text-xs font-bold cursor-pointer backdrop-blur-md flex items-center gap-2"
                                    >
                                        <i className="pi pi-music text-[11px]" />
                                        <span className="truncate">{post.audioTrack || post.music || post.category || 'Original audio'}</span>
                                    </button>
                                </div>
                            </section>
                        );
                    })}

                    {feedQuery.hasNextPage && (
                        <div className="h-24 flex items-center justify-center bg-black">
                            <button
                                type="button"
                                onClick={() => feedQuery.fetchNextPage()}
                                disabled={feedQuery.isFetchingNextPage}
                                className="border border-white/15 bg-white/10 text-white rounded-full px-5 py-2 text-sm font-bold cursor-pointer disabled:opacity-60"
                            >
                                {feedQuery.isFetchingNextPage ? 'Loading...' : 'Load more reels'}
                            </button>
                        </div>
                    )}
                </div>

                {sharePost && (
                    <SharePostDialog
                        visible={!!sharePost}
                        onHide={() => setSharePost(null)}
                        post={sharePost}
                        user={user}
                    />
                )}

                {commentPost && (
                    <div className="absolute inset-0 z-40 flex items-end bg-black/35" onClick={() => setCommentPost(null)}>
                        <div
                            className="w-full h-[68%] max-h-[620px] rounded-t-[28px] bg-[var(--surface-1)] text-[var(--text-main)] shadow-[0_-18px_50px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black">Comments</span>
                                    <span className="text-[11px] text-[var(--text-sub)] truncate max-w-[260px]">
                                        {commentPost.caption || 'Reel discussion'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCommentPost(null)}
                                    className="w-9 h-9 rounded-full border-0 bg-[var(--surface-2)] text-[var(--text-main)] cursor-pointer flex items-center justify-center"
                                    aria-label="Close comments"
                                >
                                    <i className="pi pi-times text-sm" />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0">
                                <Comment
                                    postId={commentPost._id}
                                    setVisible={() => setCommentPost(null)}
                                    onProfileClick={setProfileDetailId}
                                    isOwnPost={commentPost.user?._id?.toString() === user?._id?.toString()}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <style>{`
                @keyframes reelsHeartBurst {
                    0% { opacity: 0; transform: scale(0.5) rotate(-8deg); }
                    25% { opacity: 1; transform: scale(1.15) rotate(4deg); }
                    100% { opacity: 0; transform: scale(1.45) rotate(0deg); }
                }
                .reels-heart-burst {
                    animation: reelsHeartBurst 850ms ease-out forwards;
                }
            `}</style>
            </div>
        </div>
    );
};

export default Reels;
