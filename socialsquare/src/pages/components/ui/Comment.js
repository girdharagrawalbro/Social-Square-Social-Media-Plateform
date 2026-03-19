import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { createComment } from '../../../store/slices/postsSlice';
import axios from 'axios';

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
    const dispatch = useDispatch();
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(false);
    const [liked, setLiked] = useState(comment.likes?.includes(loggeduser._id));
    const [likeCount, setLikeCount] = useState(comment.likes?.length || 0);
    const [replies, setReplies] = useState(comment.repliesList || []);

    const handleLike = async () => {
        try {
            await axios.post(`${BASE}/api/post/comments/${comment._id}/like`, { userId: loggeduser._id });
            setLiked(prev => !prev);
            setLikeCount(prev => liked ? prev - 1 : prev + 1);
        } catch { }
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        try {
            const res = await axios.post(`${BASE}/api/post/comments/add`, {
                content: replyText,
                postId,
                user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture },
                parentId: comment._id,
            });
            setReplies(prev => [...prev, res.data]);
            setReplyText('');
            setShowReply(false);
            setShowReplies(true);
        } catch { }
    };

    const isOwn = comment.user._id === loggeduser._id || comment.user._id?.toString() === loggeduser._id;

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
                        <button onClick={handleLike} className="text-xs font-semibold border-0 bg-transparent cursor-pointer p-0"
                            style={{ color: liked ? '#ef4444' : '#6b7280' }}>
                            {liked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : ''}
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

                    {/* Reply input */}
                    {showReply && (
                        <form onSubmit={handleReplySubmit} className="flex gap-2 mt-2 items-center">
                            <img src={loggeduser.profile_picture} alt="" className="rounded-full object-cover" style={{ width: 24, height: 24 }} />
                            <input
                                type="text"
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder={`Reply to ${comment.user.fullname}...`}
                                className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1 outline-none"
                                autoFocus
                            />
                            <button type="submit" className="text-xs bg-[#808bf5] text-white border-0 rounded-full px-3 py-1 cursor-pointer">Send</button>
                        </form>
                    )}

                    {/* Replies toggle */}
                    {replies.length > 0 && (
                        <button onClick={() => setShowReplies(v => !v)} className="text-xs text-indigo-500 font-semibold border-0 bg-transparent cursor-pointer mt-1 p-0">
                            {showReplies ? '▲ Hide' : `▼ ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                        </button>
                    )}

                    {/* Replies list */}
                    {showReplies && replies.map(reply => (
                        <CommentItem key={reply._id} comment={reply} postId={postId} loggeduser={loggeduser} onDelete={onDelete} depth={depth + 1} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Comment = ({ postId, setVisible }) => {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector(state => state.users);
    const { comments, loading } = useSelector(state => state.posts);
    const [formData, setFormData] = useState({ content: '' });
    const [localComments, setLocalComments] = useState(null);

    // Use local state for delete/add without full refetch
    const displayComments = localComments ?? comments;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        dispatch(createComment({
            postId,
            content: formData.content,
            user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }
        })).unwrap().then((result) => {
            setLocalComments(prev => [...(prev ?? comments ?? []), { ...result.data, repliesList: [] }]);
            setFormData({ content: '' });
        }).catch(console.error);
    };

    const handleDelete = async (commentId, parentId) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await axios.delete(`${BASE}/api/post/comments/${commentId}`, { data: { userId: loggeduser._id } });
            if (parentId) {
                // Remove reply from parent
                setLocalComments(prev => (prev ?? comments).map(c =>
                    c._id === parentId ? { ...c, repliesList: c.repliesList.filter(r => r._id !== commentId) } : c
                ));
            } else {
                setLocalComments(prev => (prev ?? comments).filter(c => c._id !== commentId));
            }
        } catch { }
    };

    return (
        <div className="comment border-t">
            {/* Comment list */}
            <div className="p-3 flex flex-col gap-2 max-h-64 overflow-y-auto">
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

            {/* Input */}
            <div className="border-t p-2 flex gap-2 items-center">
                <img src={loggeduser?.profile_picture || '/default-profile.png'} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
                <form onSubmit={handleSubmit} className="flex w-full gap-1">
                    <input
                        type="text"
                        placeholder="Write a comment..."
                        className="flex-1 text-sm border border-gray-200 rounded-full px-3 py-1.5 outline-none bg-gray-50"
                        name="content"
                        value={formData.content}
                        onChange={e => setFormData({ content: e.target.value })}
                    />
                    <button type="submit" className="bg-[#808bf5] text-white border-0 rounded-full px-3 py-1 cursor-pointer">
                        <i className="pi pi-send" style={{ fontSize: '14px' }}></i>
                    </button>
                    <button type="button" onClick={() => setVisible(false)} className="bg-gray-100 border-0 rounded-full px-3 py-1 cursor-pointer text-gray-500">
                        <i className="pi pi-times" style={{ fontSize: '14px' }}></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Comment;