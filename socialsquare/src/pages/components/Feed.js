import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSelector, useDispatch } from 'react-redux';
import SkeletonPost from './ui/SkeletonPost';
import { OverlayPanel } from 'primereact/overlaypanel';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { ConfirmPopup } from 'primereact/confirmpopup';
import { fetchPosts, fetchComments, unlikepost, likepost } from '../../store/slices/postsSlice';
import relativeTime from '../../utils/relativeTime';

const HeartBurst = ({ visible }) => visible ? (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, pointerEvents: 'none', animation: 'heartBurst 0.8s ease forwards' }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="#ef4444">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
    </div>
) : null;

const ImageCarousel = ({ images, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);
    if (!images || images.length === 0) return null;

    if (images.length === 1) {
        return (
            <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd}>
                <img src={images[0]} alt="Post" style={{ width: '100%', display: 'block' }} />
            </div>
        );
    }

    return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ position: 'relative' }}>
            <img src={images[current]} alt={`Post image ${current + 1}`} style={{ width: '100%', display: 'block' }} />
            {current > 0 && (
                <button onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#fff', cursor: 'pointer', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            )}
            {current < images.length - 1 && (
                <button onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#fff', cursor: 'pointer', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            )}
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px' }}>
                {current + 1} / {images.length}
            </div>
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', zIndex: 2 }}>
                {images.map((_, i) => (
                    <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); }}
                        style={{ width: i === current ? '16px' : '6px', height: '6px', borderRadius: '3px', border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />
                ))}
            </div>
        </div>
    );
};

const Feed = () => {
    const op = useRef(null);
    const loaderRef = useRef(null);
    const isFetching = useRef(false);
    const dispatch = useDispatch();
    const { posts, loading, hasMore, nextCursor } = useSelector(state => state.posts);
    const { loggeduser } = useSelector(state => state.users);
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible] = useState({});
    const lastTap = useRef({});

    useEffect(() => {
        if (loggeduser?._id) dispatch(fetchPosts({ userId: loggeduser._id }));
    }, [dispatch, loggeduser]);

    const loadMore = useCallback(() => {
        if (isFetching.current || !hasMore || loading.posts) return;
        isFetching.current = true;
        dispatch(fetchPosts({ cursor: nextCursor, userId: loggeduser?._id })).finally(() => {
            isFetching.current = false;
        });
    }, [dispatch, hasMore, nextCursor, loading.posts, loggeduser]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting) loadMore(); },
            { threshold: 0.1 }
        );
        const el = loaderRef.current;
        if (el) observer.observe(el);
        return () => { if (el) observer.unobserve(el); };
    }, [loadMore]);

    const toggleComments = (postId) => {
        dispatch(fetchComments(postId));
        setVisiblePostId(prev => prev === postId ? null : postId);
    };

    const handleLikeToggle = (post) => {
        dispatch(post?.likes?.includes(loggeduser?._id)
            ? unlikepost({ postId: post._id, userId: loggeduser._id })
            : likepost({ postId: post._id, userId: loggeduser._id })
        );
    };

    const handleImageDoubleClick = (post) => {
        if (!post?.likes?.includes(loggeduser?._id)) dispatch(likepost({ postId: post._id, userId: loggeduser._id }));
        setHeartVisible(prev => ({ ...prev, [post._id]: true }));
        setTimeout(() => setHeartVisible(prev => ({ ...prev, [post._id]: false })), 800);
    };

    const handleImageTap = (post) => {
        const now = Date.now();
        const last = lastTap.current[post._id] || 0;
        if (now - last < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    };

    const getImages = (post) => {
        if (post.image_urls?.length > 0) return post.image_urls;
        if (post.image_url) return [post.image_url];
        return [];
    };

    return (
        <>
            <style>{`
                @keyframes heartBurst {
                    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
                    70%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
                }
                .music-tag { animation: musicPulse 2s ease-in-out infinite; }
                @keyframes musicPulse {
                    0%, 100% { opacity: 1; } 50% { opacity: 0.6; }
                }
            `}</style>

            <div>
                {loading.posts && posts.length === 0 ? (
                    <div className="mt-3 rounded flex flex-col gap-3">
                        {[1, 2, 3].map(i => <SkeletonPost key={i} />)}
                    </div>
                ) : (
                    <div className="mt-3 rounded flex flex-col gap-3">
                        {posts.length > 0 ? posts.map((post, index) => {
                            const images = getImages(post);
                            return (
                                <div key={post._id || index} className="relative overflow-hidden w-full rounded-xl shadow-md flex flex-col gap-1 border">

                                    {/* Header */}
                                    <div className="flex items-center justify-between px-2 pt-2">
                                        <div className="flex items-center gap-2">
                                            <img src={post.user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                                            <div className="flex flex-col gap-0">
                                                <h6 className="m-0 p-0 font-medium">{post.user.fullname}</h6>
                                                {/* Location tag */}
                                                {post.location?.name && (
                                                    <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        📍 {post.location.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Music tag */}
                                        {post.music?.title && (
                                            <div className="music-tag" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fdf2f8', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: '#ec4899' }}>
                                                🎵 {post.music.title}{post.music.artist ? ` — ${post.music.artist}` : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* Images */}
                                    {images.length > 0 && (
                                        <div className="relative">
                                            <ImageCarousel
                                                images={images}
                                                onDoubleClick={() => handleImageDoubleClick(post)}
                                                onTouchEnd={() => handleImageTap(post)}
                                            />
                                            <HeartBurst visible={!!heartVisible[post._id]} />
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="bg-white text-black rounded-t-xl w-full">
                                        <div className="flex flex-col gap-1 p-3">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div onClick={() => handleLikeToggle(post)} className="flex items-center gap-2 cursor-pointer">
                                                    <Like isliked={post?.likes?.includes(loggeduser?._id)} loading={post?.likes?.includes(loggeduser?._id) ? loading.like : loading.unlike} />
                                                </div>
                                                <button onClick={() => toggleComments(post._id)} className="flex items-center justify-center gap-2">
                                                    <i className="pi pi-comment" style={{ fontSize: '1.3rem', color: 'black' }}></i>
                                                </button>
                                                <button onClick={e => op.current.toggle(e)} className="flex items-center justify-center gap-2">
                                                    <i className="pi pi-share-alt" style={{ fontSize: '1.3rem', color: 'black' }}></i>
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <p className="m-0 text-xs"><span className="font-medium text-sm">{post?.likes?.length}</span> likes</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className=""><span className="font-medium">{post.user.fullname}</span> {post.caption}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="m-0 text-xs text-gray-700 font-medium">View all <span className="font-medium">{post.comments?.length || 0}</span> comments</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="m-0 text-xs text-gray-400">{relativeTime(post.updatedAt)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <ConfirmPopup />
                                    {visiblePostId === post._id && (
                                        <Comment postId={post._id} setVisible={() => setVisiblePostId(null)} />
                                    )}
                                </div>
                            );
                        }) : <p>No posts to display.</p>}

                        {/* Infinite scroll sentinel */}
                        <div ref={loaderRef} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {loading.posts && posts.length > 0 && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                            {!hasMore && posts.length > 0 && <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>}
                        </div>
                    </div>
                )}
                <OverlayPanel header="Share" ref={op}>
                    <div className="w-64 p-2">Share</div>
                </OverlayPanel>
            </div>
        </>
    );
};

export default Feed;