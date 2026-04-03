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

const UserProfile = lazy(() => import('./UserProfile'));

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── POST MENU ────────────────────────────────────────────────────────────────
const PostMenu = ({ post, user, onEdit, onDelete, onSave, isSaved, onReport, isSaving, onShareToStory }) => {
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
            <button onClick={() => setOpen(v => !v)} className="bg-transparent border-0 cursor-pointer p-1.5 rounded-full text-[var(--text-sub)] hover:bg-[var(--surface-2)] transition flex items-center justify-center">
                <i className="pi pi-ellipsis-h" style={{ fontSize: '14px' }}></i>
            </button>
            {open && (
                <div className="absolute right-0 top-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden mt-1" style={{ minWidth: '180px' }}>
                    <button onClick={() => { if (!isSaving) onSave(); setOpen(false) }} disabled={isSaving} style={{ opacity: isSaving ? 0.5 : 1 }} className="w-full px-4 py-2.5 border-0 bg-transparent cursor-pointer text-left text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition flex items-center gap-2">
                        <span>{isSaved ? '🔖' : '🔖'}</span> {isSaved ? 'Unsave' : 'Save post'}
                    </button>
                    {!isOwner && <button onClick={() => { onReport(); setOpen(false) }} className="w-full px-4 py-2.5 border-0 bg-transparent cursor-pointer text-left text-sm text-red-500 hover:bg-[var(--surface-2)] transition flex items-center gap-2">
                        <span>🚩</span> Report post
                    </button>}
                    {isOwner && <>
                        <button onClick={() => { onEdit(); setOpen(false) }} className="w-full px-4 py-2.5 border-0 bg-transparent cursor-pointer text-left text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition flex items-center gap-2">
                            <span>✏️</span> Edit post
                        </button>
                        <button onClick={() => { onShareToStory(); setOpen(false) }} className="w-full px-4 py-2.5 border-0 bg-transparent cursor-pointer text-left text-sm text-[#808bf5] hover:bg-[var(--surface-2)] transition flex items-center gap-2">
                            <span>✨</span> Share to Story
                        </button>
                        <button onClick={() => { onDelete(); setOpen(false) }} className="w-full px-4 py-2.5 border-0 bg-transparent cursor-pointer text-left text-sm text-red-500 hover:bg-[var(--surface-2)] transition flex items-center gap-2">
                            <span>🗑️</span> Delete post
                        </button>
                    </>}
                </div>
            )}
        </div>
    );
};

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

    const { data: fetchedPost, isLoading: isPostLoading } = usePostDetail(activePostId);

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

    const incrementViewMutation = useIncrementView();

    useEffect(() => {
        if (post?._id) {
            incrementViewMutation.mutate({ postId: post._id });
        }
        // Intentionally omit `incrementViewMutation` from deps to avoid
        // re-running when React Query returns a new mutation object identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [post?._id]); // Increment once when post ID changes

    useEffect(() => {
        if (!post?._id || !loggeduser?._id) return;
        setPostLikes(post.likes || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [post?._id, loggeduser?._id, post?.likes]);

    const images = post?.image_urls?.length > 0 ? post.image_urls : post?.image_url ? [post.image_url] : [];
    const isLiked = postLikes?.some(id => id?.toString() === loggeduser?._id?.toString());

    if (isPostLoading && !post) return (
        <div className="max-w-2xl mx-auto p-4 mt-6 text-center">
            <p className="text-4xl mb-2">⏳</p>
            <p className="text-gray-500">Loading post details...</p>
        </div>
    );

    if (!post) return (
        <div className="max-w-2xl mx-auto p-4 mt-6 text-center">
            <p className="text-4xl mb-2">😕</p>
            <p className="text-gray-500">Post not found or has been deleted.</p>
            <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-[#808bf5] text-white rounded-lg border-0 cursor-pointer">Go home</button>
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
                {/* Custom Close Button for mobile/tablet or for cleaner look */}
                <button
                    onClick={onHide}
                    className="absolute top-4 right-4 z-[60] bg-[var(--surface-1)] shadow-md border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-[var(--surface-2)] transition text-[var(--text-main)] md:hidden"
                >
                    <i className="pi pi-times" style={{ fontSize: '14px' }}></i>
                </button>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT COLUMN - IMAGE */}

                    <div className="hidden md:flex flex-1 bg-[var(--surface-1)] items-center justify-center p-0 relative overflow-hidden">
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img
                                src={images[currentImage]}
                                alt="Post"
                                onDoubleClick={handleImageDoubleClick}
                                onTouchEnd={handleImageTap}
                                className="max-w-full max-h-full object-contain cursor-pointer"
                            />
                            {heartVisible && (
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none animate-heartBurst">
                                    <span className="text-8xl">❤️</span>
                                </div>
                            )}

                            {images.length > 1 && (
                                <>
                                    {currentImage > 0 && (
                                        <button onClick={() => setCurrentImage(c => c - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer">
                                            <i className="pi pi-chevron-left"></i>
                                        </button>
                                    )}
                                    {currentImage < images.length - 1 && (
                                        <button onClick={() => setCurrentImage(c => c + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-[var(--surface-1)]/50 hover:bg-[var(--surface-1)] text-[var(--text-main)] rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer">
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
                        </div>
                    </div>

                    {/* RIGHT COLUMN - ACTIONS & COMMENTS */}
                    <div className="w-full md:w-[450px] flex flex-col border-l border-[var(--border-color)] bg-[var(--surface-1)]">
                        {/* Scrollable Content */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Author & Caption */}
                            <div className="px-4 py-3 border-b border-[var(--border-color)] flex-shrink-0">
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
                                                <span className="font-bold text-sm text-[var(--text-main)] truncate cursor-pointer" onClick={() => handleProfileClick(post.user?._id)}>{post.user?.fullname}</span>
                                                {post.user?.isVerified && <i className="pi pi-check-circle text-blue-500" style={{ fontSize: '11px' }}></i>}
                                            </div>
                                            {post.collaborators?.length > 0 && (
                                                <span className="text-[var(--text-sub)] text-[10px] font-medium tracking-tight">Collaborators: {post.collaborators.length}</span>
                                            )}
                                            <span className="text-[var(--text-sub)] text-[10px]">{formatDate(post.createdAt)}</span>
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
                                    onClick={handleLikeToggle}
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
                                    onClick={() => {
                                        const input = document.querySelector('input[placeholder="Write a comment..."]');
                                        if (input) input.focus();
                                    }}
                                >
                                    <i className="pi pi-comment text-xl text-[var(--text-main)] group-hover:scale-110 transition-transform"></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.comments?.length || 0}</span>
                                </div>
                                <div
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    onClick={() => setShareVisible(true)}
                                >
                                    <i className="pi pi-send text-xl text-[var(--text-main)] group-hover:scale-110 transition-transform -rotate-12"></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">Share</span>
                                </div>
                                <div
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    onClick={handleSave}
                                    style={{ opacity: isSaving ? 0.5 : 1 }}
                                >
                                    <i className={`pi ${isSaved ? 'pi-bookmark-fill' : 'pi-bookmark'} text-xl ${isSaved ? 'text-[#808bf5]' : 'text-[var(--text-main)]'} group-hover:scale-110 transition-transform`}></i>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">{isSaved ? 'Saved' : 'Save'}</span>
                                </div>
                            </div>


                            {/* Similar Posts */}
                            <div className="">
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
                        background: #e5e7eb;
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