import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { likepost, unlikepost, fetchComments } from '../store/slices/postsSlice';
import { Helmet } from 'react-helmet-async';
import Comment from './components/ui/Comment';
import formatDate from '../utils/formatDate';

const BASE = process.env.REACT_APP_BACKEND_URL;

const PostDetail = () => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { loggeduser } = useSelector(state => state.users);
    const { comments, loading } = useSelector(state => state.posts);

    const [post, setPost] = useState(null);
    const [loadingPost, setLoadingPost] = useState(true);
    const [currentImage, setCurrentImage] = useState(0);
    const [showComments, setShowComments] = useState(true);

    useEffect(() => {
        if (!postId) return;
        setLoadingPost(true);
        // Fetch single post — reuse feed endpoint filtered by id
        fetch(`${BASE}/api/post/detail/${postId}`)
            .then(r => r.json())
            .then(data => { setPost(data); setLoadingPost(false); dispatch(fetchComments(postId)); })
            .catch(() => setLoadingPost(false));
    }, [postId, dispatch]);

    const handleLikeToggle = () => {
        if (!post || !loggeduser?._id) return;
        const isLiked = post.likes?.includes(loggeduser._id);
        if (isLiked) {
            dispatch(unlikepost({ postId: post._id, userId: loggeduser._id }));
            setPost(prev => ({ ...prev, likes: prev.likes.filter(id => id !== loggeduser._id) }));
        } else {
            dispatch(likepost({ postId: post._id, userId: loggeduser._id }));
            setPost(prev => ({ ...prev, likes: [...(prev.likes || []), loggeduser._id] }));
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied!');
    };

    const images = post?.image_urls?.length > 0 ? post.image_urls : post?.image_url ? [post.image_url] : [];
    const isLiked = post?.likes?.includes(loggeduser?._id);

    if (loadingPost) return (
        <div className="max-w-2xl mx-auto p-4 mt-6">
            <div className="bg-white rounded-2xl shadow overflow-hidden animate-pulse">
                <div className="h-96 bg-gray-200" />
                <div className="p-4 flex flex-col gap-3">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                    </div>
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                </div>
            </div>
        </div>
    );

    if (!post) return (
        <div className="max-w-2xl mx-auto p-4 mt-6 text-center">
            <p className="text-4xl mb-2">😕</p>
            <p className="text-gray-500">Post not found or has been deleted.</p>
            <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-[#808bf5] text-white rounded-lg border-0 cursor-pointer">Go home</button>
        </div>
    );

    return (
        <>
            {/* SEO meta tags for this post */}
            <Helmet>
                <title>{post.user?.fullname} on Social Square: "{post.caption?.slice(0, 60)}"</title>
                <meta name="description" content={post.caption} />
                <meta property="og:title" content={`${post.user?.fullname} on Social Square`} />
                <meta property="og:description" content={post.caption} />
                {images[0] && <meta property="og:image" content={images[0]} />}
                <meta property="og:url" content={window.location.href} />
                <meta property="og:type" content="article" />
                <meta name="twitter:card" content="summary_large_image" />
            </Helmet>

            <div className="max-w-2xl mx-auto p-4 mt-4">
                {/* Back button */}
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 border-0 bg-transparent cursor-pointer mb-4 p-0">
                    <i className="pi pi-arrow-left"></i> Back
                </button>

                <div className="bg-white rounded-2xl shadow overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <img src={post.user?.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                            <div>
                                <p className="m-0 font-semibold text-sm">{post.user?.fullname}</p>
                                {post.location?.name && <p className="m-0 text-xs text-gray-400">📍 {post.location.name}</p>}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 m-0">{formatDate(post.createdAt)}</p>
                    </div>

                    {/* Images */}
                    {images.length > 0 && (
                        <div className="relative">
                            <img src={images[currentImage]} alt="Post" className="w-full object-cover" style={{ maxHeight: '500px' }} />
                            {images.length > 1 && (
                                <>
                                    {currentImage > 0 && (
                                        <button onClick={() => setCurrentImage(c => c - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 20 }}>‹</button>
                                    )}
                                    {currentImage < images.length - 1 && (
                                        <button onClick={() => setCurrentImage(c => c + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 20 }}>›</button>
                                    )}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                        {images.map((_, i) => (
                                            <div key={i} className="rounded-full" style={{ width: i === currentImage ? 16 : 6, height: 6, background: i === currentImage ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="p-4">
                        <div className="flex items-center gap-4 mb-3">
                            <button onClick={handleLikeToggle} className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0">
                                <span style={{ fontSize: '22px' }}>{isLiked ? '❤️' : '🤍'}</span>
                            </button>
                            <button onClick={() => setShowComments(v => !v)} className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0">
                                <i className="pi pi-comment" style={{ fontSize: '20px', color: '#374151' }}></i>
                            </button>
                            <button onClick={copyLink} className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0 ml-auto">
                                <i className="pi pi-link" style={{ fontSize: '18px', color: '#374151' }}></i>
                            </button>
                        </div>

                        <p className="text-sm font-semibold m-0">{post.likes?.length || 0} likes</p>

                        <p className="text-sm mt-2 m-0">
                            <span className="font-semibold">{post.user?.fullname}</span>{' '}
                            {post.caption}
                        </p>

                        {post.music?.title && (
                            <p className="text-xs text-pink-500 mt-1 m-0">🎵 {post.music.title}{post.music.artist ? ` — ${post.music.artist}` : ''}</p>
                        )}

                        <p className="text-xs text-gray-400 mt-2 m-0">{formatDate(post.createdAt)}</p>
                    </div>

                    {/* Comments */}
                    {showComments && (
                        <Comment postId={postId} setVisible={() => setShowComments(false)} />
                    )}
                </div>
            </div>
        </>
    );
};

export default PostDetail;