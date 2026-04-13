import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useLikePost, useSavePost, useDeletePost, useUpdatePost, usePostDetail, useSimilarPosts, useReactPost, useIncrementView } from '../../hooks/queries/usePostQueries';
import ReactionPicker from './ReactionPicker';
import PollCard from './PollCard';
import usePostStore from '../../store/zustand/usePostStore';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import axios from 'axios';
import Comment from './ui/Comment';
import SharePostDialog from './ui/SharePostDialog';
import Like from './ui/Like';
import formatDate from '../../utils/formatDate';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import ReportDialog from './ui/ReportDialog';
import PostMenu from './ui/PostMenu';

const UserProfile = lazy(() => import('./UserProfile'));

const BASE = process.env.REACT_APP_BACKEND_URL;



// ─── POST DETAIL ─────────────────────────────────────────────────────────────


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

    // Use initialPost only if it matches our active ID, otherwise use fetchedPost
    const post = (initialPost && initialPost._id === activePostId) ? initialPost : fetchedPost;

    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const [currentImage, setCurrentImage] = useState(0);
    const [heartVisible, setHeartVisible] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [postLikes, setPostLikes] = useState(post?.likes || []);
    const [reportVisible, setReportVisible] = useState(false);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const reactMutation = useReactPost();
    const [pickerVisible, setPickerVisible] = useState(false);
    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);
    const lastTap = useRef({});
    const viewedPostIdRef = useRef(null);
    const incrementViewMutation = useIncrementView();

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

    if (isPostLoading && !post) return (
        <div className="max-w-2xl mx-auto p-20 mt-6 text-center bg-[var(--surface-1)]">
            <div className="inline-block w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[var(--text-sub)] font-medium">Loading post details...</p>
        </div>
    );

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

    const handleLikeToggle = () => {
        // ✅ Prevent clicking while request is in progress
        if (likeMutation.isPending) return;

        // Optimistic update
        if (isLiked) {
            setPostLikes(prev => prev.filter(id => id?.toString() !== loggeduser?._id?.toString()));
        } else {
            setPostLikes(prev => [...prev, loggeduser._id]);
        }
        likeMutation.mutate({ postId: post._id, isLiked });
    };

    const handleReact = (emoji) => {
        reactMutation.mutate({ postId: post._id, emoji });
        setPickerVisible(false);
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

    const handleDelete = () => {
        confirmDialog({
            message: 'Are you sure you want to delete this post?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                deleteMutation.mutate({ postId: post._id }, {
                    onSuccess: () => {
                        toast.success('Post deleted');
                        onHide();
                    },
                });
            }
        });
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: post._id, caption: editCaption }, {
            onSuccess: () => { toast.success('Updated'); setEditingPost(null); }
        });
    };

    const handleReport = async (reason) => {
        try {
            await axios.post(`${BASE}/api/post/report`, { postId: post._id, reason, userId: loggeduser._id });
            toast.success('Report submitted');
            setReportVisible(false);
        } catch { toast.error('Failed to report'); }
    };

    const handleProfileClick = (userId) => {
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
            <ReportDialog visible={reportVisible} onHide={() => setReportVisible(false)} onSubmit={handleReport} />

            <div className="flex flex-col h-full bg-[var(--surface-1)] overflow-hidden relative" style={{ borderRadius: '12px' }}>
                {/* Removed redundant mobile close button as it is now handled by the Dialog wrapper */}

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT COLUMN - IMAGE */}

                    <div className="hidden md:flex flex-1 bg-[var(--surface-1)] items-center justify-center p-0 relative overflow-hidden">
                        <div className="relative w-full h-full flex items-center justify-center">
                            {/* VIDEO RENDERER */}
                            {post?.video ? (
                                <div className="relative w-full h-full flex items-center justify-center bg-black">
                                    <video
                                        src={post.video}
                                        controls
                                        onDoubleClick={handleImageDoubleClick}
                                        onTouchEnd={handleImageTap}
                                        className="max-w-full max-h-full object-contain"
                                        style={{ display: 'block' }}
                                    />
                                </div>
                            ) : (
                                <>
                                    <img
                                        src={images[currentImage]}
                                        alt="Post"
                                        onDoubleClick={handleImageDoubleClick}
                                        onTouchEnd={handleImageTap}
                                        className="max-w-full max-h-full object-contain cursor-pointer"
                                    />
                                    {images.length > 1 && (
                                        <>
                                            {currentImage > 0 && (
                                                <button aria-label="Previous image" onClick={() => setCurrentImage(c => c - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer">
                                                    <i className="pi pi-chevron-left"></i>
                                                </button>
                                            )}
                                            {currentImage < images.length - 1 && (
                                                <button aria-label="Next image" onClick={() => setCurrentImage(c => c + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer">
                                                    <i className="pi pi-chevron-right"></i>
                                                </button>
                                            )}
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/10 backdrop-blur-sm p-1.5 rounded-full">
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
                        </div>
                    </div>

                    {/* RIGHT COLUMN - ACTIONS & COMMENTS */}
                    <div className="w-full md:w-[450px] flex flex-col h-full border-l border-[var(--border-color)] bg-[var(--surface-1)]">
                        {/* Scrollable Content */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* MOBILE ONLY - MEDIA (image/video). Desktop uses the left column. */}
                            <div className="md:hidden flex-shrink-0 border-b border-[var(--border-color)] bg-[var(--surface-1)]">
                                <div className="relative w-full h-[34vh] max-h-[360px] flex items-center justify-center overflow-hidden">
                                    {post?.video ? (
                                        <video
                                            src={post.video}
                                            controls
                                            onDoubleClick={handleImageDoubleClick}
                                            onTouchEnd={handleImageTap}
                                            className="w-full h-full object-contain"
                                            style={{ display: 'block', background: 'black' }}
                                        />
                                    ) : images[currentImage] ? (
                                        <>
                                            <img
                                                src={images[currentImage]}
                                                alt="Post"
                                                onDoubleClick={handleImageDoubleClick}
                                                onTouchEnd={handleImageTap}
                                                className="w-full h-full object-contain cursor-pointer"
                                                style={{ background: 'black' }}
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
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-9 h-9 flex items-center justify-center shadow-md transition border-0 cursor-pointer"
                                                        >
                                                            <i className="pi pi-chevron-right"></i>
                                                        </button>
                                                    )}
                                                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/10 backdrop-blur-sm p-1.5 rounded-full">
                                                        {images.map((_, i) => (
                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImage ? 'w-4 bg-white' : 'bg-white/50'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-sm text-[var(--text-sub)] bg-[var(--surface-2)]">
                                            No media
                                        </div>
                                    )}

                                    {heartVisible && (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none animate-heartBurst">
                                            <span className="text-7xl">❤️</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Author & Caption */}
                            <div className="px-4 py-3 border-b border-[var(--border-color)] shrink md:shrink-0 max-h-[26vh] overflow-y-auto md:max-h-none md:overflow-visible">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={post.user?.profile_picture}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover border border-[var(--border-color)]"
                                            onClick={() => handleProfileClick(post.user._id)}
                                        />
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="font-bold text-sm text-[var(--text-main)] truncate cursor-pointer hover:text-[#808bf5] transition" onClick={() => handleProfileClick(post.user?._id)}>{post.user?.fullname}</span>
                                                {post.collaborators?.filter(c => c.status === 'accepted').length > 0 && (() => {
                                                    const collab = post.collaborators.find(c => c.status === 'accepted');
                                                    return (
                                                        <>
                                                            <span className="text-[var(--text-sub)] text-xs font-normal ml-0.5">and</span>
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
                                        </div>
                                    </div>
                                    <PostMenu
                                        post={post}
                                        user={loggeduser}
                                        isSaved={isSaved}
                                        onSave={handleSave}
                                        onEdit={() => { setEditingPost(post); setEditCaption(post.caption); }}
                                        onDelete={handleDelete}
                                        onReport={() => setReportVisible(true)}
                                        onShareToStory={() => setSharingPostToStory(post)}
                                        isSaving={isSaving}
                                    />
                                </div>
                                <div className="text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap font-medium">
                                    {post.caption}
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
                                <Comment postId={post._id} onProfileClick={handleProfileClick} />
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
                                <div
                                    className="flex flex-col items-center gap-1 group cursor-pointer relative"
                                    role="button"
                                    tabIndex="0"
                                    aria-label="Like post"
                                    onClick={handleLikeToggle}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLikeToggle(); } }}
                                    onMouseEnter={() => !window.matchMedia('(pointer: coarse)').matches && setPickerVisible(true)}
                                    onMouseLeave={() => setPickerVisible(false)}
                                >
                                    <Like id={`pd-like-${post._id}`} isliked={isLiked} loading={likeMutation.isPending} />
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-bold text-[var(--text-sub)]">{postLikes?.length || 0}</span>
                                        {post.reactions?.length > 0 && (
                                            <div className="flex -space-x-1 items-center bg-[var(--surface-2)] px-1 rounded-full border border-[var(--border-color)]">
                                                {[...new Set(post.reactions.map(r => r.emoji))].slice(0, 3).map((emoji, i) => (
                                                    <span key={i} className="text-[8px] leading-none">{emoji}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {pickerVisible && <ReactionPicker onSelect={handleReact} onClose={() => setPickerVisible(false)} />}
                                </div>
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
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.comments?.length || 0}</span>
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
                            {/* Similar Posts */}
                            <div className="hidden md:block">
                                <SimilarPosts postId={post._id} onPostClick={(id) => setActivePostId(id)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '500px' }} onHide={() => setProfileVisible(false)}>
                <Suspense fallback={<div className="p-4 text-center text-[var(--text-sub)]">Loading Profile...</div>}>
                    <UserProfile id={selectedProfileId} />
                </Suspense>
            </Dialog>

            <Dialog header={false} visible={!!editingPost} style={{ width: '95vw', maxWidth: '420px', borderRadius: '24px' }} onHide={() => setEditingPost(null)} closable={false} className="dark:bg-[var(--surface-1)]">
                {editingPost && (
                    <div className="p-6 flex flex-col gap-5 bg-[var(--surface-1)] rounded-3xl">
                        <div className="flex justify-between items-center">
                            <h3 className="m-0 text-xl font-bold text-[var(--text-main)] font-outfit">Edit Post</h3>
                            <button onClick={() => setEditingPost(null)} className="bg-[var(--surface-2)] border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:opacity-80 transition text-[var(--text-main)]">✕</button>
                        </div>
                        <div className="flex items-center gap-3 bg-[var(--surface-2)] p-3 rounded-2xl border border-[var(--border-color)]">
                            <img src={editingPost.user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover border border-[var(--border-color)]" />
                            <span className="font-bold text-sm text-[var(--text-main)]">{editingPost.user.fullname}</span>
                        </div>
                        <div className="relative">
                            <textarea
                                value={editCaption}
                                onChange={e => setEditCaption(e.target.value)}
                                rows={6}
                                placeholder="Add a new caption..."
                                className="w-full bg-[var(--surface-2)] border-2 border-[var(--border-color)] rounded-2xl p-4 text-sm text-[var(--text-main)] resize-none focus:border-[#808bf5] outline-none transition font-medium"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setEditingPost(null)} className="flex-1 py-3.5 border-2 border-[var(--border-color)] rounded-2xl bg-transparent cursor-pointer text-sm font-bold text-[var(--text-sub)] hover:bg-[var(--surface-2)] transition">Cancel</button>
                            <button onClick={handleEditSubmit} disabled={updateMutation.isPending} className="flex-1 py-3.5 bg-[#808bf5] text-white border-0 rounded-2xl cursor-pointer text-sm font-bold shadow-lg shadow-indigo-200/20 hover:opacity-90 transition disabled:opacity-50">
                                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}
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

    if (isLoading) return <div className="p-4 text-center text-xs text-[var(--text-sub)]">Loading similar posts...</div>;
    if (items.length === 0) return null;

    return (
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--surface-1)]">
            <h4 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-3">Similar Posts</h4>
            <div className="grid grid-cols-3 gap-2">
                {items.slice(0, 3).map(item => (
                    <div key={item._id} onClick={() => onPostClick(item._id)} className="aspect-square rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer hover:opacity-80 transition-opacity">
                        {(item.image_urls?.[0] || item.image_url) ? (
                            <img src={item.image_urls?.[0] || item.image_url} alt="" className="w-full h-full object-cover" />
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