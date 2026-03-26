import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/zustand/useAuthStore';
import { api } from '../../store/zustand/useAuthStore';
import { useLikePost, useSavePost, useDeletePost, useUpdatePost, usePostDetail } from '../../hooks/queries/usePostQueries';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import axios from 'axios';
import Comment from './ui/Comment';
import formatDate from '../../utils/formatDate';
import { confirmDialog } from 'primereact/confirmdialog';
import ReportDialog from './ui/ReportDialog';

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

// ─── SHARE DIALOG ─────────────────────────────────────────────────────────────
const ShareDialog = ({ post, visible, onHide, user }) => {
    const [conversations, setConversations] = useState([]);
    const [sending, setSending] = useState(null);
    const postUrl = `${window.location.origin}/post/${post?._id}`;

    useEffect(() => {
        if (!visible || !user?._id) return;
        api.get(`/api/conversation/${user._id}`)
            .then(({ data }) => {
                const normalized = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.conversations)
                        ? data.conversations
                        : [];
                setConversations(normalized);
            })
            .catch(() => setConversations([]));
    }, [visible, user]);

    const copyLink = () => { navigator.clipboard.writeText(postUrl); toast.success('Link copied!'); };
    const shareToConv = async (conv) => {
        setSending(conv._id);
        const other = conv.participants.find(p => p.userId !== user._id);
        try {
            await api.post('/api/conversation/messages/create', {
                conversationId: conv._id,
                sender: user._id,
                senderName: user.fullname,
                content: `🔗 Shared a post: ${postUrl}`,
                recipientId: other?.userId,
            });
            toast.success(`Shared to ${other?.fullname || 'conversation'}`);
        } catch { toast.error('Failed to share'); }
        setSending(null);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Share post</h3>
                <div className="flex flex-col gap-3">
                    <button onClick={copyLink} className="flex items-center gap-3 p-3 bg-gray-100 border-0 rounded-xl cursor-pointer font-semibold text-sm hover:bg-gray-200">🔗 Copy link</button>
                    {Array.isArray(conversations) && conversations.map(conv => {
                        const other = conv.participants.find(p => p.userId !== user._id);
                        return (
                            <button key={conv._id} onClick={() => shareToConv(conv)} disabled={sending === conv._id} className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-left hover:bg-gray-100">
                                <img src={other?.profilePicture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover" />
                                <span className="text-sm font-medium">{other?.fullname || 'Unknown'}</span>
                                {sending === conv._id && <span className="ml-auto text-xs text-indigo-500">Sending...</span>}
                            </button>
                        );
                    })}
                </div>
                <button onClick={onHide} className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-xl border-0 cursor-pointer font-medium hover:bg-gray-300">Close</button>
            </div>
        </div>
    );
};

const PostDetail = ({ post: initialPost, postId, onHide }) => {
    const navigate = useNavigate();
    const loggeduser = useAuthStore(s => s.user);
    const followUser = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const { data: fetchedPost, isLoading: isPostLoading } = usePostDetail(!initialPost && postId ? postId : null);
    const post = initialPost || fetchedPost;

    const likeMutation = useLikePost();
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();

    const [currentImage, setCurrentImage] = useState(0);
    const [heartVisible, setHeartVisible] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [shareVisible, setShareVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [postLikes, setPostLikes] = useState(post?.likes || []);
    const [reportVisible, setReportVisible] = useState(false);
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
        if (isFollowing) unfollowUser(post.user._id);
        else followUser(post.user._id);
    };

    const handleReport = async (reason) => {
        try {
            await axios.post(`${BASE}/api/post/report`, { postId: post._id, reason, userId: loggeduser._id });
            toast.success('Report submitted');
            setReportVisible(false);
        } catch { toast.error('Failed to report'); }
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

            <ShareDialog post={post} visible={shareVisible} onHide={() => setShareVisible(false)} user={loggeduser} />
            <ReportDialog visible={reportVisible} onHide={() => setReportVisible(false)} onSubmit={handleReport} />

            <div className="flex ">
                {/* LEFT SIDE - POST */}
                <div className="flex-1 flex flex-col bg-black md:max-w-2xl">
                    {/* Images */}
                    {images.length > 0 && (
                        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                            <img
                                src={images[currentImage]}
                                alt="Post"
                                onDoubleClick={handleImageDoubleClick}
                                onTouchEnd={handleImageTap}
                                
                                className="h-[45vh] object-contain cursor-pointer"
                            />
                            {/* Heart Animation */}
                            {heartVisible && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none', animation: 'heartBurst 0.8s ease forwards' }}>
                                    <span style={{ fontSize: '80px' }}>❤️</span>
                                </div>
                            )}
                            {/* Image Controls */}
                            {images.length > 1 && (
                                <>
                                    {currentImage > 0 && (
                                        <button onClick={() => setCurrentImage(c => c - 1)} className="absolute left-3 top-1/2 transform -translate-y-1/2 z-5 bg-white/30 hover:bg-white/50 text-white rounded-full w-10 h-10 flex items-center justify-center border-0 cursor-pointer font-bold text-xl">‹</button>
                                    )}
                                    {currentImage < images.length - 1 && (
                                        <button onClick={() => setCurrentImage(c => c + 1)} className="absolute right-3 top-1/2 transform -translate-y-1/2 z-5 bg-white/30 hover:bg-white/50 text-white rounded-full w-10 h-10 flex items-center justify-center border-0 cursor-pointer font-bold text-xl">›</button>
                                    )}
                                    <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-5 flex gap-1">
                                        {images.map((_, i) => (
                                            <button key={i} onClick={() => setCurrentImage(i)} className={`rounded-full border-0 cursor-pointer transition-all ${i === currentImage ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/70'}`} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Post Info */}
                    <div className="bg-white border-t">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3 flex-1">
                                <img src={post.user?.profile_picture} alt="" className="w-12 h-12 rounded-full object-cover" />
                                <div className="flex-1">
                                    <p className="m-0 font-semibold text-sm">{post.user?.fullname}</p>
                                    <p className="text-xs text-gray-500 m-0">{formatDate(post.createdAt)}</p>
                                </div>
                            </div>
                            {!isOwner && (
                                <button onClick={handleFollow} className={`px-4 py-1 rounded-full border-0 font-semibold text-sm cursor-pointer ${isFollowing ? 'bg-gray-200 text-gray-700' : 'bg-[#808bf5] text-white'}`}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                            )}
                            <PostMenu post={post} user={loggeduser} onEdit={() => setEditingPost(post)} onDelete={handleDelete} onSave={handleSave} isSaved={isSaved} onReport={() => setReportVisible(true)} isSaving={isSaving} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4 px-4 py-3 border-b">
                            <button onClick={handleLikeToggle} className="bg-transparent border-0 cursor-pointer p-0">
                                <span className="text-2xl">{isLiked ? '❤️' : '🤍'}</span>
                            </button>
                            <button className="bg-transparent border-0 cursor-pointer p-0">
                                <i className="pi pi-comment text-xl text-gray-700"></i>
                            </button>
                            <button onClick={() => setShareVisible(true)} className="bg-transparent border-0 cursor-pointer p-0">
                                <i className="pi pi-send text-xl text-gray-700"></i>
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className="ml-auto bg-transparent border-0 cursor-pointer p-0" style={{ opacity: isSaving ? 0.5 : 1, pointerEvents: isSaving ? 'none' : 'auto' }}>
                                <i className={`pi text-xl ${isSaved ? 'pi-bookmark-fill text-[#808bf5]' : 'pi-bookmark text-gray-700'}`}></i>
                            </button>
                        </div>

                        {/* Caption */}
                        <div className="px-4 py-3">
                            <p className="text-sm font-semibold mb-2">{postLikes?.length || 0} likes</p>
                            {editingPost ? (
                                <div className="flex gap-2 mb-3">
                                    <textarea
                                        value={editCaption}
                                        onChange={e => setEditCaption(e.target.value)}
                                        className="flex-1 p-2 border border-gray-300 rounded-lg text-sm resize-none"
                                        rows="3"
                                    />
                                    <div className="flex flex-col gap-2">
                                        <button onClick={handleEditSubmit} className="px-3 py-1 bg-[#808bf5] text-white rounded border-0 cursor-pointer text-sm font-semibold">Save</button>
                                        <button onClick={() => setEditingPost(null)} className="px-3 py-1 bg-gray-300 text-gray-700 rounded border-0 cursor-pointer text-sm font-semibold">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm leading-5 m-0">
                                    <span className="font-semibold">{post.user?.fullname}</span> {post.caption}
                                </p>
                            )}
                            {post.music?.title && (
                                <p className="text-xs text-pink-500 mt-2 m-0">🎵 {post.music.title}{post.music.artist ? ` — ${post.music.artist}` : ''}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE - COMMENTS */}
                <div className="w-full h-full md:w-96 flex flex-col bg-gray-50 border-l">
                    <div className="flex-1 overflow-y-auto">
                        <Comment postId={post._id} />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes heartBurst {
                    0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
                    100% { transform: translate(-50%, -150%) scale(1.5); opacity: 0; }
                }
            `}</style>
        </>
    );
};

export default PostDetail;