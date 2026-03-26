import React, { useState } from 'react';
import useAuthStore from '../../../store/zustand/useAuthStore';
import { useComments, useCreateComment } from '../../../hooks/queries/usePostQueries';
import axios from 'axios';
import { confirmDialog } from 'primereact/confirmdialog';

const BASE = process.env.REACT_APP_BACKEND_URL;

const formatDateTime = (dateString) => {
    const diff = Date.now() - new Date(dateString);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return new Date(dateString).toLocaleDateString();
};

const CommentItem = ({ comment, postId, loggeduser, onDelete, depth = 0 }) => {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(false);
    const [replies, setReplies] = useState(comment.repliesList || []);
    const [liking, setLiking] = useState(false);

    // ✅ Fix: compare as strings to handle ObjectId vs string mismatch
    const loggedUserId = loggeduser._id?.toString();
    const isLikedInitial = (comment.likes || []).some(id => id?.toString() === loggedUserId);
    const [liked, setLiked] = useState(isLikedInitial);
    const [likeCount, setLikeCount] = useState(comment.likes?.length || 0);

    const handleLike = async () => {
        // ✅ Prevent duplicate requests while liking
        if (liking) return;
        
        // ✅ Optimistic update first
        const wasLiked = liked;
        setLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
        setLiking(true);
        try {
            await axios.post(`${BASE}/api/post/comments/${comment._id}/like`, { userId: loggedUserId });
        } catch {
            // Rollback on error
            setLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        } finally {
            setLiking(false);
        }
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        try {
            const res = await axios.post(`${BASE}/api/post/comments/add`, {
                content: replyText, postId,
                user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture },
                parentId: comment._id,
            });
            setReplies(prev => [...prev, res.data]);
            setReplyText('');
            setShowReply(false);
            setShowReplies(true);
        } catch {}
    };

    const isOwn = comment.user._id?.toString() === loggedUserId;

    return (
        <div style={{ marginLeft: depth > 0 ? '40px' : '0', marginBottom: '8px' }}>
            <div className="flex gap-2 items-start">
                <img src={comment.user.profile_picture || '/default-profile.png'} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
                <div className="flex-1">
                    <div className="bg-gray-50 rounded-2xl px-3 py-2">
                        <p className="m-0 text-xs font-semibold">{comment.user.fullname}</p>
                        <p className="m-0 text-sm">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-1">
                        <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>

                        {/* ✅ Like button with optimistic update and disabled state during request */}
                        <button
                            onClick={handleLike}
                            disabled={liking}
                            className="text-xs font-semibold border-0 bg-transparent cursor-pointer p-0 flex items-center gap-1 transition"
                            style={{ 
                                color: liked ? '#ef4444' : '#6b7280',
                                opacity: liking ? 0.6 : 1,
                                pointerEvents: liking ? 'none' : 'auto'
                            }}
                            title={liking ? "Updating..." : "Like"}
                        >
                            {liked ? '❤️' : '🤍'} {likeCount > 0 && <span>{likeCount}</span>}
                        </button>

                        {depth === 0 && (
                            <button onClick={() => setShowReply(v => !v)} className="text-xs font-semibold text-gray-500 border-0 bg-transparent cursor-pointer p-0">
                                Reply
                            </button>
                        )}
                        {isOwn && (
                            <button onClick={() => onDelete(comment._id, comment.parentId)} className="text-xs text-red-400 border-0 bg-transparent cursor-pointer p-0">
                                Delete
                            </button>
                        )}
                    </div>

                    {showReply && (
                        <form onSubmit={handleReplySubmit} className="flex gap-2 mt-2 items-center">
                            <img src={loggeduser.profile_picture} alt="" className="rounded-full object-cover" style={{ width: 24, height: 24 }} />
                            <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                                placeholder={`Reply to ${comment.user.fullname}...`}
                                className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1 outline-none" autoFocus />
                            <button type="submit" className="text-xs bg-[#808bf5] text-white border-0 rounded-full px-3 py-1 cursor-pointer">Send</button>
                        </form>
                    )}

                    {replies.length > 0 && (
                        <button onClick={() => setShowReplies(v => !v)} className="text-xs text-indigo-500 font-semibold border-0 bg-transparent cursor-pointer mt-1 p-0">
                            {showReplies ? '▲ Hide' : `▼ ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                        </button>
                    )}

                    {showReplies && replies.map(reply => (
                        <CommentItem key={reply._id} comment={reply} postId={postId} loggeduser={loggeduser} onDelete={onDelete} depth={depth + 1} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Comment = ({ postId, setVisible }) => {
    const user = useAuthStore(s => s.user);
    const loggeduser = user;
    const [formData, setFormData] = useState({ content: '' });
    const [localComments, setLocalComments] = useState(null);

    const { data: fetchedComments, isLoading: commentsLoading } = useComments(postId);
    const createCommentMutation = useCreateComment();

    const comments = fetchedComments || [];
    const displayComments = localComments ?? comments;
    const loading = { comments: commentsLoading };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        const payload = {
            postId, content: formData.content,
            user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }
        };
        createCommentMutation.mutate(payload, {
            onSuccess: (res) => {
                setLocalComments(prev => [...(prev ?? comments ?? []), { ...res.data, repliesList: [] }]);
                setFormData({ content: '' });
            },
            onError: console.error,
        });
    };

    const handleDelete = async (commentId, parentId) => {
        confirmDialog({
            message: 'Are you sure you want to delete this comment?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await axios.delete(`${BASE}/api/post/comments/${commentId}`, { data: { userId: loggeduser._id } });
                    if (parentId) {
                        setLocalComments(prev => (prev ?? comments).map(c =>
                            c._id === parentId ? { ...c, repliesList: c.repliesList.filter(r => r._id !== commentId) } : c
                        ));
                    } else {
                        setLocalComments(prev => (prev ?? comments).filter(c => c._id !== commentId));
                    }
                } catch {}
            }
        });
    };

    return (
        <div className="comment flex flex-col h-full bg-white">
            {/* Scrollable Comments Section */}
            <div className="flex-1 overflow-y-auto border-b p-3 flex flex-col gap-2 max-h-[600px]">
                {loading.comments || !displayComments ? (
                    <p className="text-gray-400 text-xs text-center">Loading...</p>
                ) : displayComments.length > 0 ? (
                    displayComments.map(comment => (
                        <CommentItem key={comment._id} comment={comment} postId={postId} loggeduser={loggeduser} onDelete={handleDelete} />
                    ))
                ) : (
                    <p className="text-gray-400 text-xs text-center">No comments yet. Be the first!</p>
                )}
            </div>
            
            {/* Fixed Input Section at Bottom */}
            <div className="border-t p-3 flex gap-2 items-center bg-white flex-shrink-0">
                <img src={loggeduser?.profile_picture || '/default-profile.png'} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
                <form onSubmit={handleSubmit} className="flex w-full gap-2">
                    <input type="text" placeholder="Write a comment..." className="flex-1 text-sm border border-gray-200 rounded-full px-3 py-2 outline-none bg-gray-50 focus:border-[#808bf5]"
                        name="content" value={formData.content} onChange={e => setFormData({ content: e.target.value })} />
                    <button type="submit" className="bg-[#808bf5] hover:bg-[#6b7ae6] text-white border-0 rounded-full px-4 py-2 cursor-pointer transition">
                        <i className="pi pi-send" style={{ fontSize: '14px' }}></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Comment;