import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useLikePost, useSavePost, usePostDetail, useSimilarPosts, useReactPost, useIncrementView } from '../../hooks/queries/usePostQueries';
import ReactionPicker from './ReactionPicker';
import PollCard from './PollCard';
import usePostStore from '../../store/zustand/usePostStore';
import { Helmet } from 'react-helmet-async';
import toast from '../../utils/toast.js';
// import axios from 'axios';
import Comment from './ui/Comment';
import SharePostDialog from './ui/SharePostDialog';
import formatDate from '../../utils/formatDate';
import { Dialog } from 'primereact/dialog';
import PostMenu from './ui/PostMenu';
import ProgressiveImage from './ui/ProgressiveImage';
import { BeforeAfterView, FeedVideo } from './ui/PostItem';
import { getMediaThumbnail } from '../../utils/mediaUtils';
import useWindowWidth from '../../hooks/useWindowWidth';
import PostDetailSkeleton from './ui/PostDetailSkeleton';
import SimilarPostsSkeleton from './ui/SimilarPostsSkeleton';



const UserProfile = lazy(() => import('./UserProfile'));

const PostDetail = ({ post: initialPost, postId, onHide }) => {
    const navigate = useNavigate();
    const loggeduser = useAuthStore(s => s.user);
    const [activePostId, setActivePostId] = useState(postId || initialPost?._id);

    // Sync with prop if it changes from outside
    useEffect(() => {
        if (postId) setActivePostId(postId);
        else if (initialPost?._id) setActivePostId(initialPost._id);
    }, [postId, initialPost?._id]);

    const { data: fetchedPost, isLoading: isPostLoading, error: postError } = usePostDetail(activePostId);

    // Use fetchedPost only if available, otherwise fall back to initialPost as a placeholder
    const post = fetchedPost || (initialPost && initialPost._id === activePostId ? initialPost : null);


    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const [currentImage, setCurrentImage] = useState(0);
    const [heartVisible, setHeartVisible] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [postLikes, setPostLikes] = useState(post?.likes || []);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const reactMutation = useReactPost();
    const [pickerVisible, setPickerVisible] = useState(false);
    const { setSharingPostToStory} = usePostStore();
    const lastTap = useRef({});
    const viewedPostIdRef = useRef(null);
    const incrementViewMutation = useIncrementView();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;
    const [expandedCaption, setExpandedCaption] = useState(false);
    const [showTags, setShowTags] = useState(false);


    useEffect(() => {
        if (post?._id && viewedPostIdRef.current !== post._id) {
            viewedPostIdRef.current = post._id;
            incrementViewMutation.mutate({ postId: post._id });
        }
    }, [post?._id, incrementViewMutation]);

    useEffect(() => {
        if (!post?._id || !loggeduser?._id) return;
        setPostLikes(post.likes || []);
    }, [post?._id, loggeduser?._id, post?.likes]);

    const images = post?.image_urls?.length > 0 ? post.image_urls : post?.image_url ? [post.image_url] : [];
    const isLiked = postLikes?.some(id => id?.toString() === loggeduser?._id?.toString());

    if (isPostLoading && !post) return <PostDetailSkeleton />;


    // Check for Privacy Error (403 from backend)
    if (postError?.response?.status === 403) {
        const privateOwner = postError.response.data.owner;
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--surface-1)] h-full min-h-[400px]">
                <div className="relative mb-6">
                    <img
                        src={privateOwner?.profile_picture}
                        alt=""
                        className="w-24 h-24 rounded-full object-cover border-4 border-[var(--surface-2)] shadow-xl"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#808bf5] text-white w-8 h-8 rounded-full flex items-center justify-center border-4 border-[var(--surface-1)]">
                        <i className="pi pi-lock text-xs"></i>
                    </div>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">{privateOwner?.fullname}</h2>
                <p className="text-[var(--text-sub)] text-sm max-w-[280px] mb-8 font-medium">
                    This account is private. Follow this user to see their posts and interactions.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => handleProfileClick(privateOwner?._id)}
                        className="px-6 py-2.5 bg-[#808bf5] text-white rounded-xl border-0 font-bold cursor-pointer hover:opacity-90 transition shadow-lg shadow-indigo-500/20"
                    >
                        View Profile
                    </button>
                    <button
                        onClick={onHide}
                        className="px-6 py-2.5 bg-[var(--surface-2)] text-[var(--text-main)] rounded-xl border-0 font-bold cursor-pointer hover:opacity-80 transition"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!post) return (
        <div className="max-w-2xl mx-auto p-12 mt-6 text-center bg-[var(--surface-1)] rounded-3xl">
            <p className="text-5xl mb-4">😕</p>
            <h3 className="text-xl font-bold mb-2">Post Unavailable</h3>
            <p className="text-[var(--text-sub)] mb-8">This post might have been deleted or is no longer accessible.</p>
            <button onClick={() => navigate('/')} className="px-8 py-3 bg-[#808bf5] text-white rounded-xl border-0 font-bold cursor-pointer shadow-lg shadow-indigo-500/20">Go home</button>
        </div>
    );

    const handleReact = (emoji) => {
        if (reactMutation.isPending) return;
        reactMutation.mutate({ postId: post._id, emoji });
        setPickerVisible(false);
    };

    const handleLikeToggle = () => {
        if (likeMutation.isPending) return;
        if (isLiked) {
            setPostLikes(prev => prev.filter(id => id?.toString() !== loggeduser?._id?.toString()));
            likeMutation.mutate({ postId: post._id, isLiked: true });
        } else {
            setPostLikes(prev => [...prev, loggeduser._id]);
            likeMutation.mutate({ postId: post._id, isLiked: false });
        }
    };

    const handleImageDoubleClick = () => {
        // ✅ Prevent clicking while request is in progress
        if (likeMutation.isPending) return;

        if (!isLiked) {
            // Optimistic update for double-click like
            setPostLikes(prev => [...prev, loggeduser._id]);
            likeMutation.mutate({ postId: post._id, isLiked: false });
        }
        setHeartVisible(true);
        setTimeout(() => setHeartVisible(false), 800);
    };

    const handleImageTap = () => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] || 0) < 300) handleImageDoubleClick();
        lastTap.current[post._id] = now;
    };

    const handleSave = () => {
        if (isSaving) return;
        setIsSaving(true);
        const wasSaved = isSaved;
        setIsSaved(!wasSaved);
        saveMutation.mutate({ postId: post._id }, {
            onSuccess: (res) => setIsSaved(res.data.saved),
            onError: () => { setIsSaved(wasSaved); toast.error('Failed to save'); },
            onSettled: () => setIsSaving(false),
        });
    };



    const handleProfileClick = (userId, isAnonymous) => {
        if (isAnonymous) return;
        setSelectedProfileId(userId);
        setProfileVisible(true);
    };

    return (
        <>
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

            <SharePostDialog
                post={post}
                visible={shareVisible}
                onHide={() => setShareVisible(false)}
                user={loggeduser}
                onShareToStory={() => setSharingPostToStory(post)}
            />


            <div className={`flex flex-col h-full bg-[var(--surface-1)] overflow-hidden relative ${(!post?.video && images.length === 0 && !post.isBeforeAfter) ? 'post-detail-text-only' : ''}`} style={{ borderRadius: isDesktop ? '12px' : '0' }}>
                {(!post?.video && images.length === 0 && !post.isBeforeAfter) && (
                    <style>{`
                        @media (min-width: 1024px) {
                            .p-dialog:has(.post-detail-text-only) {
                                max-width: 500px !important;
                            }
                        }
                    `}</style>
                )}
                {/* Removed redundant mobile close button as it is now handled by the Dialog wrapper */}

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT COLUMN - IMAGE */}
                    {(post?.video || images.length > 0 || post.isBeforeAfter) && (
                        <div className="hidden md:flex flex-1 bg-[var(--surface-1)] items-center justify-center p-0 relative overflow-hidden">
                            {post.isBeforeAfter && post.beforeAfter ? (
                                <div className="w-full p-4">
                                    <BeforeAfterView
                                        post={post}
                                        beforeAfter={post.beforeAfter}
                                        onImageDoubleClick={handleImageDoubleClick}
                                        onImageTap={handleImageTap}
                                        locked={false}
                                        heartVisible={heartVisible}
                                    />
                                </div>
                            ) : (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    {/* VIDEO RENDERER */}
                                    {post?.video ? (
                                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                                            <FeedVideo
                                                src={post.video}
                                                poster={post.videoThumbnail || getMediaThumbnail(post.video, 'video')}
                                                onDoubleClick={handleImageDoubleClick}
                                                onTouchEnd={handleImageTap}
                                                isLocked={false}
                                                fileKey={post.videoKey}
                                                iv={post.videoIv}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <ProgressiveImage
                                                src={images[currentImage]}
                                                alt="Post"
                                                onDoubleClick={handleImageDoubleClick}
                                                onTouchEnd={handleImageTap}
                                                objectFit="contain"
                                                className="cursor-pointer"
                                                fileKey={post.mediaKeys?.[currentImage]?.key}
                                                iv={post.mediaKeys?.[currentImage]?.iv}
                                            />
                                            {images.length > 1 && (
                                                <>
                                                    {currentImage > 0 && (
                                                        <button aria-label="Previous image" onClick={() => setCurrentImage(c => c - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)]/10 text-[var(--text-main)] rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer z-10">
                                                            <i className="pi pi-chevron-left"></i>
                                                        </button>
                                                    )}
                                                    {currentImage < images.length - 1 && (
                                                        <button aria-label="Next image" onClick={() => setCurrentImage(c => c + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)]/10 text-[var(--text-main)] rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer  z-10">
                                                            <i className="pi pi-chevron-right"></i>
                                                        </button>
                                                    )}
                                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/10 backdrop-blur-lg p-1.5 rounded-full">
                                                        {images.map((_, i) => (
                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImage ? 'w-4 bg-white' : 'bg-white/50'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}

                                    {/* SHARED HEART ANIMATION */}
                                    {heartVisible && (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none animate-heartBurst">
                                            <span className="text-8xl">❤️</span>
                                        </div>
                                    )}

                                    {/* Tagged/Mentioned Users Overlay on Image - DESKTOP */}
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
                                                            if (handleProfileClick) handleProfileClick(uid);
                                                        }}
                                                        className="text-xs font-medium text-white hover:text-[#808bf5] cursor-pointer flex items-center gap-1.5 transition-colors"
                                                    >
                                                        @{name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Human Icon Trigger Button - DESKTOP */}
                                    {post.mentions && post.mentions.length > 0 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowTags(prev => !prev); }}
                                            className={`absolute bottom-3 left-3 z-30 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center cursor-pointer transition-all shadow-md active:scale-90 ${showTags ? 'bg-[#808bf5] text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
                                            title="Show Tagged Users"
                                        >
                                            <i className="pi pi-user" style={{ fontSize: '12px' }}></i>
                                        </button>
                                    )}

                                    {/* AI Insight Overlay - DESKTOP */}
                                    {post.aiSummary && (
                                        <div 
                                            className={`absolute bottom-3 right-3 ${post.mentions && post.mentions.length > 0 ? 'left-14' : 'left-3'} z-30 p-3 bg-black/65 backdrop-blur-md border border-white/10 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <i className="pi pi-sparkles text-[10px] text-[#808bf5] animate-pulse"></i>
                                                <span className="text-[9px] font-black uppercase tracking-wider text-[#808bf5]">
                                                    AI Insight
                                                </span>
                                            </div>
                                            <p className="m-0 text-xs text-white leading-relaxed font-medium">
                                                {post.aiSummary}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RIGHT COLUMN - ACTIONS & COMMENTS */}
                    <div className={`${(post?.video || images.length > 0 || post.isBeforeAfter) ? 'w-full md:w-[450px]' : 'w-full'} flex flex-col h-full ${(post?.video || images.length > 0 || post.isBeforeAfter) && isDesktop ? 'border-l border-[var(--border-color)]' : ''} bg-[var(--surface-1)]`}>
                        {/* Scrollable Content */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* MOBILE ONLY - MEDIA (image/video). Desktop uses the left column. */}
                            {(post?.video || images.length > 0 || post.isBeforeAfter) && (
                                <div className="md:hidden flex-shrink-0 border-b border-[var(--border-color)] bg-[var(--surface-1)]">
                                    <div className="relative w-full h-full min-h-[260px] flex items-center justify-center overflow-hidden">
                                        {post.isBeforeAfter && post.beforeAfter ? (
                                            <div className="w-full p-3">
                                                <BeforeAfterView
                                                    post={post}
                                                    beforeAfter={post.beforeAfter}
                                                    onImageDoubleClick={handleImageDoubleClick}
                                                    onImageTap={handleImageTap}
                                                    locked={false}
                                                    heartVisible={heartVisible}
                                                />
                                            </div>
                                        ) : post?.video ? (
                                            <div className="relative w-full h-full">
                                                <FeedVideo
                                                    src={post.video}
                                                    poster={post.videoThumbnail || getMediaThumbnail(post.video, 'video')}
                                                    onDoubleClick={handleImageDoubleClick}
                                                    onTouchEnd={handleImageTap}
                                                    isLocked={false}
                                                    fileKey={post.videoKey}
                                                    iv={post.videoIv}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <ProgressiveImage
                                                    src={images[currentImage]}
                                                    alt="Post"
                                                    onDoubleClick={handleImageDoubleClick}
                                                    onTouchEnd={handleImageTap}
                                                    objectFit="contain"
                                                    style={{ background: 'black' }}
                                                    fileKey={post.mediaKeys?.[currentImage]?.key}
                                                    iv={post.mediaKeys?.[currentImage]?.iv}
                                                />
                                                {images.length > 1 && (
                                                    <>
                                                        {currentImage > 0 && (
                                                            <button
                                                                aria-label="Previous image"
                                                                onClick={() => setCurrentImage(c => c - 1)}
                                                                className="absolute left-3 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-9 h-9 flex items-center justify-center shadow-md transition border-0 cursor-pointer"
                                                            >
                                                                <i className="pi pi-chevron-left"></i>
                                                            </button>
                                                        )}
                                                        {currentImage < images.length - 1 && (
                                                            <button
                                                                aria-label="Next image"
                                                                onClick={() => setCurrentImage(c => c + 1)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-9 h-9 flex items-center justify-center shadow-md transition border-0 cursor-pointer z-index-999"
                                                            >
                                                                <i className="pi pi-chevron-right"></i>
                                                            </button>
                                                        )}
                                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/10 backdrop-blur-lg p-1.5 rounded-full">
                                                            {images.map((_, i) => (
                                                                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImage ? 'w-4 bg-white' : 'bg-white/50'}`} />
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        {heartVisible && (
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none animate-heartBurst">
                                                <span className="text-7xl">❤️</span>
                                            </div>
                                        )}

                                        {/* Tagged/Mentioned Users Overlay on Image - MOBILE */}
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
                                                                if (handleProfileClick) handleProfileClick(uid);
                                                            }}
                                                            className="text-xs font-semibold text-white hover:text-[#808bf5] cursor-pointer flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <i className="pi pi-user text-[10px]"></i>
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

                                        {/* AI Insight Overlay - MOBILE */}
                                        {post.aiSummary && (
                                            <div 
                                                className={`absolute bottom-3 right-3 ${post.mentions && post.mentions.length > 0 ? 'left-14' : 'left-3'} z-30 p-3 bg-black/65 backdrop-blur-md border border-white/10 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <i className="pi pi-sparkles text-[10px] text-[#808bf5] animate-pulse"></i>
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-[#808bf5]">
                                                        AI Insight
                                                    </span>
                                                </div>
                                                <p className="m-0 text-xs text-white leading-relaxed font-medium">
                                                    {post.aiSummary}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Author & Caption */}
                            <div className="px-4 py-3 border-b border-[var(--border-color)] shrink md:shrink-0 max-h-[26vh] overflow-y-auto md:max-h-none md:overflow-visible">
                                {post.isFeedbackRequest && (
                                    <div className="mb-3 p-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] shrink-0">
                                                <i className="pi pi-comments text-xs animate-bounce"></i>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-main)]">Critique Requested</span>
                                                <span className="text-[8px] text-[var(--text-sub)]">The author seeks structured reviews. Likes are disabled.</span>
                                            </div>
                                        </div>
                                        <span className="bg-[#6366f1] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm shrink-0">
                                            {post.feedbackCategory || 'General'}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {post.isAnonymous ? (
                                            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white border border-gray-100 bg-gradient-to-br from-[#808bf5] to-[#ec4899] select-none" style={{ fontSize: '14px' }}>
                                                🎭
                                            </div>
                                        ) : (
                                            <img
                                                src={post.user?.profile_picture}
                                                alt="Profile"
                                                className="w-8 h-8 rounded-full object-cover border border-[var(--border-color)] cursor-pointer hover:opacity-80 transition"
                                                onClick={() => handleProfileClick(post.user?._id)}
                                            />
                                        )}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1 min-w-0">
                                                {post.isAnonymous ? (
                                                    <span className="font-bold text-sm text-[var(--text-main)]">Anonymous</span>
                                                ) : (
                                                    <span
                                                        className="font-bold text-sm text-[var(--text-main)] truncate cursor-pointer hover:text-[#808bf5] transition"
                                                        onClick={() => handleProfileClick(post.user?._id)}
                                                    >
                                                        {post.user?.fullname}
                                                    </span>
                                                )}
                                                {post.collaborators?.filter(c => c.status === 'accepted').length > 0 && (() => {
                                                    const collab = post.collaborators.find(c => c.status === 'accepted');
                                                    return (
                                                        <>
                                                            <span className="text-[var(--text-sub)] text-xs font-medium ml-0.5">&</span>
                                                            <span
                                                                className="text-sm font-bold text-[var(--text-main)] cursor-pointer hover:text-[#808bf5] transition ml-0.5"
                                                                onClick={() => handleProfileClick(collab.userId || collab._id)}
                                                            >
                                                                {collab.fullname}
                                                                {post.collaborators.filter(c => c.status === 'accepted').length > 1 && ` and ${post.collaborators.filter(c => c.status === 'accepted').length - 1} others`}
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                                {post.user?.isVerified && <i className="pi pi-check-circle text-blue-500" style={{ fontSize: '11px' }}></i>}
                                            </div>

                                            <span className="text-[var(--text-sub)] text-[10px]">{formatDate(post.createdAt || post.updatedAt)}</span>
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
                                    <PostMenu
                                        post={post}
                                        user={loggeduser}
                                        onSuccess={onHide}
                                    />
                                </div>
                                <div className="text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap font-medium">
                                    {post.caption?.length > 35 && !expandedCaption ? (
                                        <>
                                            {post.caption.slice(0, 35)}...
                                            <span
                                                onClick={() => setExpandedCaption(true)}
                                                className="text-[#808bf5] cursor-pointer hover:underline ml-1 font-bold"
                                            >
                                                more
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            {post.caption}
                                            {post.caption?.length > 35 && expandedCaption && (
                                                <span
                                                    onClick={() => setExpandedCaption(false)}
                                                    className="text-[var(--text-sub)] cursor-pointer hover:underline ml-1 font-bold text-xs"
                                                >
                                                    show less
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>

                                {post.isCollaborative && post.collaborators?.filter(c => c.status === 'accepted').map((c, i) => (
                                    <div key={i} className="mt-2 text-sm leading-relaxed">
                                        <span className="font-bold mr-1 cursor-pointer hover:text-[#808bf5] transition" onClick={() => handleProfileClick(c.userId || c._id)}>
                                            {c.username || c.fullname}
                                        </span>
                                        <span className="font-medium whitespace-pre-wrap">{c.contribution}</span>
                                    </div>
                                ))}
                                {post.poll && <PollCard poll={post.poll} postId={post._id} />}
                                {post.music?.title && (
                                    <div className="mt-3 flex items-center gap-2 text-[11px] text-[#808bf5] font-bold uppercase tracking-wider">
                                        <i className="pi pi-music"></i>
                                        <span>{post.music.title} {post.music.artist && `• ${post.music.artist}`}</span>
                                    </div>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div className="flex-1 min-h-0">
                                <Comment postId={post._id} post={post} onProfileClick={handleProfileClick} />
                            </div>


                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="border-t border-[var(--border-color)] bg-[var(--surface-1)]">
                            {/* ENGAGEMENT BAR (As per screenshot) */}
                            <div className="flex items-center justify-around py-2 px-4 bg-[var(--surface-1)]">
                                <div className="flex flex-col items-center gap-1 cursor-default">
                                    <i className="pi pi-eye text-lg text-[var(--text-sub)]"></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.views || 0}</span>
                                </div>
                                {!post.isFeedbackRequest && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); handleLikeToggle(); }}
                                        className="flex flex-col items-center gap-1 cursor-pointer"
                                    >
                                        <i
                                            className={`pi ${isLiked ? 'pi-heart-fill' : 'pi-heart'}`}
                                            style={{ fontSize: '1.2rem', color: isLiked ? '#ef4444' : 'currentColor' }}
                                        ></i>
                                        <span className="text-[10px] font-bold text-[var(--text-sub)]">{postLikes?.length || 0}</span>
                                    </div>
                                )}
                                {!post.isFeedbackRequest ? (() => {
                                    const myReaction = post.reactions?.find(r => {
                                        const rUserId = r.userId?._id?.toString() || r.userId?.toString();
                                        const currentUserId = loggeduser?._id?.toString();
                                        return r.emoji !== '❤️' && rUserId && currentUserId && rUserId === currentUserId;
                                    });
                                    const reactionGroups = (post.reactions || []).reduce((acc, r) => {
                                        if (r.emoji !== '❤️') {
                                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                        }
                                        return acc;
                                    }, {});

                                    return (
                                        <div
                                            className="flex items-center gap-2 relative"
                                            onMouseEnter={() => !window.matchMedia('(pointer: coarse)').matches && setPickerVisible(true)}
                                            onMouseLeave={() => setPickerVisible(false)}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.matchMedia('(pointer: coarse)').matches) {
                                                        setPickerVisible(prev => !prev);
                                                    } else {
                                                        if (myReaction) {
                                                            handleReact(myReaction.emoji);
                                                        } else {
                                                            handleReact('💡');
                                                        }
                                                    }
                                                }}
                                                className="cursor-pointer flex flex-col items-center justify-center w-7 h-7 text-[var(--text-main)] hover:text-[#808bf5] transition-all"
                                                title={myReaction ? `Reacted with ${myReaction.emoji}` : "React to post"}
                                            >
                                                {myReaction ? (
                                                    <span className="text-base select-none leading-none animate-bounce-short">{myReaction.emoji}</span>
                                                ) : (
                                                    <i className="pi pi-star text-[1.2rem] opacity-75 hover:opacity-100 hover:scale-110 transition-transform"></i>
                                                )}
                                            </div>

                                            {pickerVisible && <ReactionPicker onSelect={handleReact} onClose={() => setPickerVisible(false)} />}

                                            {/* Mobile tap trigger label removed to avoid clutter */}

                                            {/* Reaction breakdown pills */}
                                            {Object.keys(reactionGroups).length > 0 && (
                                                <div className="flex gap-1.5 flex-wrap items-center">
                                                    {Object.entries(reactionGroups).map(([emoji, count]) => (
                                                        <span
                                                            key={emoji}
                                                            onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
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
                                    <div className="flex flex-col items-center gap-1 text-[#6366f1] select-none">
                                        <i className="pi pi-comments text-lg"></i>
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider">Critique</span>
                                    </div>
                                )}
                                <div
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    role="button"
                                    tabIndex="0"
                                    aria-label="Comment"
                                    onClick={() => {
                                        const input = document.querySelector('input[placeholder="Write a comment..."]');
                                        if (input) input.focus();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            const input = document.querySelector('input[placeholder="Write a comment..."]');
                                            if (input) input.focus();
                                        }
                                    }}
                                >
                                    <i className="pi pi-comment text-xl text-[var(--text-main)] group-hover:scale-110 transition-transform"></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.commentsCount !== undefined ? post.commentsCount : (post.comments?.length || 0)}</span>
                                </div>
                                <div
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    role="button"
                                    tabIndex="0"
                                    aria-label="Share post"
                                    onClick={() => setShareVisible(true)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShareVisible(true); } }}
                                >
                                    <i className="pi pi-send text-xl text-[var(--text-main)] group-hover:scale-110 transition-transform -rotate-12"></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">Share</span>
                                </div>
                                <div
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    role="button"
                                    tabIndex="0"
                                    aria-label={isSaved ? 'Unsave post' : 'Save post'}
                                    onClick={handleSave}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSave(); } }}
                                    style={{ opacity: isSaving ? 0.5 : 1 }}
                                >
                                    <i className={`pi ${isSaved ? 'pi-bookmark-fill' : 'pi-bookmark'} text-xl ${isSaved ? 'text-[#808bf5]' : 'text-[var(--text-main)]'} group-hover:scale-110 transition-transform`}></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">{isSaved ? 'Saved' : 'Save'}</span>
                                </div>
                            </div>


                            <div className="px-4 py-2">
                                <p className="m-0 text-[10px] text-[var(--text-sub)] uppercase tracking-wide">{formatDate(post.createdAt || post.updatedAt)}</p>
                            </div>
                            <div className="hidden md:block">
                                <SimilarPosts postId={post._id} onPostClick={(id) => setActivePostId(id)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '450px' }} onHide={() => setProfileVisible(false)}>
                <Suspense fallback={<div className="p-4 text-center text-[var(--text-sub)]">Loading Profile...</div>}>
                    <UserProfile id={selectedProfileId} />
                </Suspense>
            </Dialog>



            <style>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: var(--border-color);
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #d1d5db;
                    }
                    
                    @keyframes heartBurst {
                        0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; filter: drop-shadow(0 0 10px rgba(255,0,0,0.5)); }
                        50% { transform: translate(-50%, -50%) scale(1.4); opacity: 1; }
                        100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
                    }
                    .animate-heartBurst {
                        animation: heartBurst 0.8s cubic-bezier(0.17, 0.89, 0.32, 1.49) forwards;
                    }
                `}</style>
        </>
    );
};

const SimilarPosts = ({ postId, onPostClick }) => {
    const { data: items = [], isLoading } = useSimilarPosts(postId);

    if (isLoading) return <SimilarPostsSkeleton />;

    if (items.length === 0) return null;

    return (
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--surface-1)]">
            <h4 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-3">Similar Posts</h4>
            <div className="grid grid-cols-3 gap-2">
                {items.slice(0, 3).map(item => (
                    <div key={item._id} onClick={() => onPostClick(item._id)} className="aspect-square rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer hover:opacity-80 transition-opacity">
                        {(item.image_urls?.[0] || item.image_url || item.video) ? (
                            <img src={item.image_urls?.[0] || item.image_url || item.videoThumbnail || getMediaThumbnail(item.video, 'video')} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--text-sub)]">Post</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PostDetail;