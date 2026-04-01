import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/zustand/useAuthStore';
import { api } from '../../store/zustand/useAuthStore';
import { useLikePost, useSavePost, useDeletePost, useUpdatePost, usePostDetail, useSimilarPosts } from '../../hooks/queries/usePostQueries';
import { useFollowUser, useUnfollowUser } from '../../hooks/queries/useAuthQueries';
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
const PostMenu = ({ post, user, onEdit, onDelete, onSave, isSaved, onReport, isSaving }) => {
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
            <button onClick={() => setOpen(v => !v)} className="bg-transparent border-0 cursor-pointer p-2 rounded-full text-gray-500 hover:bg-gray-100 transition">⋯</button>
            {open && (
                <div className="absolute right-0 top-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden mt-1" style={{ minWidth: '170px' }}>
                    <button onClick={() => { if (!isSaving) onSave(); setOpen(false) }} disabled={isSaving} style={{ opacity: isSaving ? 0.5 : 1 }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-gray-50">{isSaved ? '🔖 Unsave' : '🔖 Save post'}</button>
                    {!isOwner && <button onClick={() => { onReport(); setOpen(false) }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-red-50 text-red-400">🚩 Report post</button>}
                    {isOwner && <>
                        <button onClick={() => { onEdit(); setOpen(false) }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-gray-50">✏️ Edit post</button>
                        <button onClick={() => { onDelete(); setOpen(false) }} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm text-red-500 hover:bg-red-50">🗑️ Delete post</button>
                    </>}
                </div>
            )}
        </div>
    );
};


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
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    const [currentImage, setCurrentImage] = useState(0);
    const [heartVisible, setHeartVisible] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [shareVisible, setShareVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [postLikes, setPostLikes] = useState(post?.likes || []);
    const [reportVisible, setReportVisible] = useState(false);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);
    const lastTap = useRef({});

    useEffect(() => {
        if (!post || !loggeduser) return;
        // Check if post is saved
        // You may need to add this to your store/query
        setIsSaved(false); // Default to false for now
        setPostLikes(post?.likes || []);
    }, [post, loggeduser]);

    const images = post?.image_urls?.length > 0 ? post.image_urls : post?.image_url ? [post.image_url] : [];
    const isLiked = postLikes?.some(id => id?.toString() === loggeduser?._id?.toString());
    const isFollowing = loggeduser?.following?.some(f => f?.toString() === post?.user._id?.toString());
    const isOwner = post?.user._id === loggeduser?._id || post?.user._id?.toString() === loggeduser?._id;

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
        // Disable button immediately
        setIsSaving(true);

        // Get current state for rollback
        const wasSaved = isSaved;

        // Optimistically update UI
        setIsSaved(!wasSaved);

        // Send request
        saveMutation.mutate({ postId: post._id }, {
            onSuccess: (res) => {
                setIsSaved(res.data.saved);
            },
            onError: () => {
                // Rollback on error
                setIsSaved(wasSaved);
                toast.error('Failed to save');
            },
            onSettled: () => {
                // Re-enable button
                setIsSaving(false);
            },
        });
    };

    const handleDelete = () => {
        confirmDialog({
            message: 'Delete this post?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                deleteMutation.mutate({ postId: post._id }, {
                    onSuccess: () => {
                        toast.success('Post deleted');
                        onHide();
                    }
                });
            }
        });
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: post._id, caption: editCaption }, {
            onSuccess: () => {
                toast.success('Updated');
                setEditingPost(null);
                post.caption = editCaption;
            }
        });
    };

    const handleFollow = () => {
        if (isFollowing) unfollowMutation.mutate({ targetUserId: post.user._id });
        else followMutation.mutate({ targetUserId: post.user._id });
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

            <div className="flex flex-col h-full bg-white overflow-hidden" style={{ borderRadius: '12px' }}>
                {/* GLOBAL HEADER */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                        <img 
                            src={post.user?.profile_picture} 
                            alt="" 
                            className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
                            onClick={() => handleProfileClick(post.user?._id)}
                        />
                        <div className="flex flex-col">
                            <span 
                                className="font-bold text-sm cursor-pointer hover:text-indigo-600 transition"
                                onClick={() => handleProfileClick(post.user?._id)}
                            >
                                {post.user?.fullname}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium">
                                {formatDate(post.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT COLUMN - IMAGE */}
                    <div className="hidden md:flex flex-1 bg-[#F8F9FA] items-center justify-center p-6 relative overflow-hidden">
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img
                                src={images[currentImage]}
                                alt="Post"
                                onDoubleClick={handleImageDoubleClick}
                                onTouchEnd={handleImageTap}
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-pointer"
                            />
                            {heartVisible && (
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none animate-heartBurst">
                                    <span className="text-8xl">❤️</span>
                                </div>
                            )}
                            
                            {images.length > 1 && (
                                <>
                                    {currentImage > 0 && (
                                        <button onClick={() => setCurrentImage(c => c - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer">
                                            <i className="pi pi-chevron-left"></i>
                                        </button>
                                    )}
                                    {currentImage < images.length - 1 && (
                                        <button onClick={() => setCurrentImage(c => c + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-md transition border-0 cursor-pointer">
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
                    <div className="w-full md:w-[450px] flex flex-col border-l bg-white">
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Author & Caption */}
                            <div className="p-4 border-b">
                                <div className="flex items-center gap-3 mb-3">
                                    <img 
                                        src={post.user?.profile_picture} 
                                        alt="" 
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                    <span className="font-bold text-sm">{post.user?.fullname}</span>
                                    {post.collaborators?.length > 0 && (
                                         <span className="text-gray-400 text-xs">Collaborators: {post.collaborators.length}</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {post.caption}
                                </div>
                                {post.music?.title && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-indigo-500 font-medium">
                                        <i className="pi pi-music"></i>
                                        <span>{post.music.title} {post.music.artist && `• ${post.music.artist}`}</span>
                                    </div>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div className="p-4">
                                <Comment postId={post._id} onProfileClick={handleProfileClick} />
                            </div>

                            {/* Similar Posts */}
                            <div className="mt-4">
                                <SimilarPosts postId={post._id} onPostClick={(id) => setActivePostId(id)} />
                            </div>
                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="border-t bg-white">
                            {/* Comment Input Mockup/Usage */}
                            <div className="p-4 flex items-center gap-3 border-b">
                                <img src={loggeduser?.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        placeholder="Add a comment..." 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-full py-2.5 px-4 pr-10 text-sm focus:outline-none focus:border-indigo-300 transition"
                                    />
                                    <i className="pi pi-face-smile absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-gray-600"></i>
                                </div>
                                <button className="bg-indigo-400 text-white px-5 py-2 rounded-full text-sm font-bold border-0 cursor-pointer hover:bg-indigo-500 transition shadow-sm active:scale-95">
                                    Comment
                                </button>
                            </div>

                            {/* ENGAGEMENT BAR (As per screenshot) */}
                            <div className="flex items-center justify-around py-3 px-4 bg-white">
                                <div className="flex flex-col items-center gap-1 cursor-default">
                                    <i className="pi pi-eye text-lg text-gray-400"></i>
                                    <span className="text-[10px] font-bold text-gray-400">{post.views || 0}</span>
                                </div>
                                <div 
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    onClick={handleLikeToggle}
                                >
                                    <Like id={`pd-like-${post._id}`} isliked={isLiked} loading={likeMutation.isPending} />
                                    <span className="text-[10px] font-bold text-gray-500">{postLikes?.length || 0}</span>
                                </div>
                                <div className="flex flex-col items-center gap-1 group cursor-pointer">
                                    <i className="pi pi-comment text-xl text-gray-900 group-hover:scale-110 transition-transform"></i>
                                    <span className="text-[10px] font-bold text-gray-500">{post.comments?.length || 0}</span>
                                </div>
                                <div 
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    onClick={() => setShareVisible(true)}
                                >
                                    <i className="pi pi-send text-xl text-gray-900 group-hover:scale-110 transition-transform -rotate-12"></i>
                                    <span className="text-[10px] font-bold text-gray-500">Share</span>
                                </div>
                                <div 
                                    className="flex flex-col items-center gap-1 group cursor-pointer"
                                    onClick={handleSave}
                                    style={{ opacity: isSaving ? 0.5 : 1 }}
                                >
                                    <i className={`pi ${isSaved ? 'pi-bookmark-fill' : 'pi-bookmark'} text-xl ${isSaved ? 'text-indigo-500' : 'text-gray-900'} group-hover:scale-110 transition-transform`}></i>
                                    <span className="text-[10px] font-bold text-gray-500">{isSaved ? 'Saved' : 'Save'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '500px' }} onHide={() => setProfileVisible(false)}>
                <Suspense fallback={<div className="p-4 text-center">Loading Profile...</div>}>
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

    if (isLoading) return <div className="p-4 text-center text-xs text-gray-400">Loading similar posts...</div>;
    if (items.length === 0) return null;

    return (
        <div className="p-4 border-t bg-white">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Similar Posts</h4>
            <div className="grid grid-cols-3 gap-2">
                {items.slice(0, 6).map(item => (
                    <div key={item._id} onClick={() => onPostClick(item._id)} className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity">
                        {(item.image_urls?.[0] || item.image_url) ? (
                            <img src={item.image_urls?.[0] || item.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">Post</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PostDetail;