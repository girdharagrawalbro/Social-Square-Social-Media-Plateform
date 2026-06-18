import React, { useState, useRef, useEffect } from 'react';
import useAuthStore, { api } from '../../../store/zustand/useAuthStore';
import { useComments, useCreateComment, useLikeComment, useDeleteComment, useMarkBestAnswer, useMarkInsightful } from '../../../hooks/queries/usePostQueries';
import { confirmDialog } from 'primereact/confirmdialog';

import MentionSuggestions from './MentionSuggestions';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

const formatDateTime = (dateString) => {
    const diff = Date.now() - new Date(dateString);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return new Date(dateString).toLocaleDateString();
};

const renderTextWithMentions = (text = '', onProfileClick) => {
    if (!text) return '';
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
            const username = part.slice(1).replace(/[^a-zA-Z0-9_.]/g, '');
            return (
                <span 
                    key={index} 
                    onClick={async (e) => {
                        e.stopPropagation();
                        try {
                            const res = await api.get(`/api/auth/public/profile/${username}`);
                            if (res.data?._id) onProfileClick(res.data._id);
                        } catch (err) {
                            console.error(err);
                        }
                    }}
                    className="text-[#808bf5] font-bold cursor-pointer hover:underline"
                >
                    {part}
                </span>
            );
        }
        return part;
    });
};

const HeartBurst = ({ visible }) => visible ? (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none', animation: 'heartBurst 0.6s ease forwards' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
    </div>
) : null;

const CommentItem = ({ comment, postId, loggeduser, onDelete, onProfileClick, depth = 0, isOwnPost }) => {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(false);
    const [replies, setReplies] = useState(comment.repliesList || []);
    const [liking, setLiking] = useState(false);
    const [heartVisible, setHeartVisible] = useState(false);
    const [showLowQuality, setShowLowQuality] = useState(false);
    const likeMutation = useLikeComment();
    const markBestMutation = useMarkBestAnswer();
    const markInsightfulMutation = useMarkInsightful();

    const commentUserId = typeof comment?.user === 'string' ? comment.user : comment?.user?._id;
    const commentUserName = (typeof comment?.user === 'object' && comment?.user?.fullname) ? comment.user.fullname : 'Unknown';
    const commentUserPicture = (typeof comment?.user === 'object' && comment?.user?.profile_picture)
        ? comment.user.profile_picture
        : 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg';

    // ✅ Fix: compare as strings to handle ObjectId vs string mismatch
    const loggedUserId = loggeduser?._id?.toString();
    const isLikedInitial = (comment.likes || []).some(id => id?.toString() === loggedUserId);
    const [liked, setLiked] = useState(isLikedInitial);
    const [likeCount, setLikeCount] = useState(comment.likes?.length || 0);

    const handleLike = async () => {
        if (liking) return;

        const wasLiked = liked;
        setLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
        setLiking(true);
        try {
            await likeMutation.mutateAsync({ commentId: comment._id, postId });
        } catch {
            setLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        } finally {
            setLiking(false);
        }
    };

    const handleDoubleClick = () => {
        if (!liked) handleLike();
        setHeartVisible(true);
        setTimeout(() => setHeartVisible(false), 600);
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        try {
            const res = await api.post(`${BASE}/api/post/comments/add`, {
                content: replyText, postId,
                user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture },
                parentId: comment._id,
            });
            setReplies(prev => [...prev, res.data]);
            setReplyText('');
            setShowReply(false);
            setShowReplies(true);
        } catch { }
    };

    const isOwn = commentUserId?.toString?.() === loggedUserId;

    return (
        <div style={{ marginLeft: depth > 0 ? '40px' : '0', marginBottom: '8px' }}>
            <div className="flex gap-2 items-start">
                <div
                    className="rounded-full overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                    style={{ width: 32, height: 32, border: '1px solid var(--border-color)' }}
                    onClick={() => commentUserId && onProfileClick?.(commentUserId)}
                >
                    <img
                        src={commentUserPicture}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="flex-1">
                    <div
                        onDoubleClick={handleDoubleClick}
                        className={`bg-[var(--surface-2)] rounded-2xl px-3 py-2 relative cursor-pointer select-none border ${comment.isBestAnswer ? 'border-green-500/50 bg-green-500/5' : comment.isInsightful ? 'border-orange-500/50 bg-orange-500/5' : 'border-transparent'}`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <p
                                className="m-0 text-xs font-semibold cursor-pointer hover:text-[#808bf5] transition text-[var(--text-main)]"
                                onClick={() => commentUserId && onProfileClick?.(commentUserId)}
                            >
                                {commentUserName}
                            </p>
                            {comment.isBestAnswer && <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold">✔ Best Answer</span>}
                            {comment.isInsightful && <span className="text-[10px] bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full font-bold">🔥 Insightful</span>}
                            {comment.topic && comment.topic !== 'General' && depth === 0 && <span className="text-[10px] text-[var(--text-sub)]">#{comment.topic}</span>}
                        </div>
                        
                        {comment.quality === 'low' && !showLowQuality ? (
                            <div className="py-1">
                                <button onClick={() => setShowLowQuality(true)} className="text-xs text-[var(--text-sub)] hover:text-[#808bf5] border-0 bg-transparent p-0 cursor-pointer flex items-center gap-1">
                                    <i className="pi pi-chevron-down text-[10px]"></i> Show low-quality reply
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="m-0 text-sm text-[var(--text-main)]">{renderTextWithMentions(comment.content, onProfileClick)}</p>
                                {comment.quality === 'low' && showLowQuality && (
                                    <button onClick={() => setShowLowQuality(false)} className="text-[10px] text-[var(--text-sub)] hover:text-[#808bf5] border-0 bg-transparent p-0 cursor-pointer mt-1">
                                        Hide
                                    </button>
                                )}
                            </>
                        )}
                        <HeartBurst visible={heartVisible} />
                    </div>
                    <div className="flex items-center flex-wrap gap-3 mt-1 px-1">
                        <span className="text-xs text-[var(--text-sub)]">{formatDateTime(comment.createdAt)}</span>

                        {/* ✅ Like button with optimistic update and disabled state during request */}
                        <button
                            onClick={handleLike}
                            disabled={liking}
                            className="text-xs font-semibold border-0 bg-transparent cursor-pointer p-0 flex items-center gap-1 transition"
                            style={{
                                color: liked ? '#ef4444' : 'var(--text-sub)',
                                opacity: liking ? 0.6 : 1,
                                pointerEvents: liking ? 'none' : 'auto'
                            }}
                            title={liking ? "Updating..." : "Like"}
                        >
                            {liked ? '❤️' : '🤍'} {likeCount > 0 && <span>{likeCount}</span>}
                        </button>

                        {depth === 0 && (
                            <button onClick={() => setShowReply(v => !v)} className="text-xs font-semibold text-[var(--text-sub)] border-0 bg-transparent cursor-pointer p-0">
                                Reply
                            </button>
                        )}
                        {isOwn && (
                            <button onClick={() => onDelete(comment._id, comment.parentId)} className="text-xs text-red-400 border-0 bg-transparent cursor-pointer p-0">
                                Delete
                            </button>
                        )}
                        {isOwnPost && depth === 0 && (
                            <>
                                <button 
                                    onClick={() => markBestMutation.mutate({ commentId: comment._id, postId })}
                                    className={`text-[10px] font-semibold border-0 bg-transparent cursor-pointer p-0 ${comment.isBestAnswer ? 'text-green-500' : 'text-[var(--text-sub)] hover:text-green-500'}`}
                                >
                                    {comment.isBestAnswer ? 'Unmark Best' : 'Mark Best'}
                                </button>
                                <button 
                                    onClick={() => markInsightfulMutation.mutate({ commentId: comment._id, postId })}
                                    className={`text-[10px] font-semibold border-0 bg-transparent cursor-pointer p-0 ${comment.isInsightful ? 'text-orange-500' : 'text-[var(--text-sub)] hover:text-orange-500'}`}
                                >
                                    {comment.isInsightful ? 'Unmark Insightful' : 'Mark Insightful'}
                                </button>
                            </>
                        )}
                    </div>

                    {showReply && (
                        <form onSubmit={handleReplySubmit} className="flex gap-2 mt-2 items-center">
                            <img src={loggeduser.profile_picture} alt="" className="rounded-full object-cover" style={{ width: 24, height: 24 }} />
                            <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                                placeholder={`Reply to ${commentUserName}...`}
                                className="flex-1 text-xs border border-[var(--border-color)] rounded-full px-3 py-1 outline-none bg-[var(--surface-2)] color-[var(--text-main)]" autoFocus />
                            <button type="submit" className="text-xs bg-[#808bf5] text-white border-0 rounded-full px-3 py-1 cursor-pointer">     <i className="pi pi-send" style={{ fontSize: '10px' }}></i></button>
                        </form>
                    )}

                    {replies.length > 0 && (
                        <button onClick={() => setShowReplies(v => !v)} className="text-xs text-[#808bf5] font-semibold border-0 bg-transparent cursor-pointer mt-1 p-0">
                            {showReplies ? '▲ Hide' : `▼ ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                        </button>
                    )}

                    {showReplies && replies.map(reply => (
                        <CommentItem key={reply._id} comment={reply} postId={postId} loggeduser={loggeduser} onDelete={onDelete} onProfileClick={onProfileClick} depth={depth + 1} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Comment = ({ postId, setVisible, onProfileClick, isOwnPost }) => {
    const user = useAuthStore(s => s.user);
    const loggeduser = user;
    const [formData, setFormData] = useState({ content: '' });
    const [localComments, setLocalComments] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef(null);

    const { data: fetchedComments, isLoading: commentsLoading } = useComments(postId);
    const createCommentMutation = useCreateComment();
    const deleteCommentMutation = useDeleteComment();

    const comments = fetchedComments || [];
    const displayComments = localComments ?? comments;
    const loading = { comments: commentsLoading };

    const topics = ['All', ...new Set((displayComments || []).map(c => c.topic).filter(Boolean))];
    const filteredComments = (displayComments || []).filter(c => selectedTopic === 'All' || c.topic === selectedTopic);
    
    // Sort logic: Best answer first, then insightful, then created at
    const sortedComments = [...filteredComments].sort((a, b) => {
        if (a.isBestAnswer && !b.isBestAnswer) return -1;
        if (!a.isBestAnswer && b.isBestAnswer) return 1;
        if (a.isInsightful && !b.isInsightful) return -1;
        if (!a.isInsightful && b.isInsightful) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const commentsEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!loggeduser?._id) return;
        if (!formData.content.trim()) return;
        const payload = {
            postId, content: formData.content,
            user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }
        };
        setFormData({ content: '' });
        createCommentMutation.mutate(payload, {
            onSuccess: (res) => {
                setLocalComments(prev => [...(prev ?? comments ?? []), { ...res.data, repliesList: [] }]);
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
            accept: () => {
                deleteCommentMutation.mutate({ commentId, postId }, {
                    onSuccess: () => {
                        if (parentId) {
                            setLocalComments(prev => (prev ?? comments).map(c =>
                                c._id === parentId ? { ...c, repliesList: c.repliesList.filter(r => r._id !== commentId) } : c
                            ));
                        } else {
                            setLocalComments(prev => (prev ?? comments).filter(c => c._id !== commentId));
                        }
                    }
                });
            }
        });
    };
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 100;

        if (isNearBottom) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [displayComments]);

    return (
        <div className="flex flex-col h-full min-h-0">
            <style>{`
                @keyframes heartBurst {
                    0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
                    50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
                    100% { transform: translate(-50%, -120%) scale(1.5); opacity: 0; }
                }
            `}</style>
            {/* Scrollable Comments Section */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-3 min-h-0"
            >
                {/* Topic Filter Pills */}
                {topics.length > 1 && (
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        {topics.map(topic => (
                            <button
                                key={topic}
                                onClick={() => setSelectedTopic(topic)}
                                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition ${selectedTopic === topic ? 'bg-[#808bf5] text-white border-0' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border border-[var(--border-color)]'}`}
                            >
                                {topic}
                            </button>
                        ))}
                    </div>
                )}

                {loading.comments || !displayComments ? (
                    <p className="text-[var(--text-sub)] text-xs text-center">Loading...</p>
                ) : sortedComments.length > 0 ? (
                    sortedComments.map(comment => (
                        <CommentItem key={comment._id} comment={comment} postId={postId} loggeduser={loggeduser} onDelete={handleDelete} onProfileClick={onProfileClick} isOwnPost={isOwnPost} />
                    ))
                ) : (
                    <p className="text-[var(--text-sub)] text-xs text-center">No comments yet. Be the first!</p>
                )}
                <div ref={commentsEndRef} />
            </div>

            {/* Fixed Input Section at Bottom */}
            <div className="relative sticky bottom-0 p-3 flex gap-2 items-center bg-[var(--surface-1)]/90 backdrop-blur-md border-t border-[var(--border-color)] z-10">
                <MentionSuggestions 
                    text={formData.content} 
                    cursorPosition={cursorPosition} 
                    onSelect={(val) => {
                        setFormData({ content: val });
                        if (inputRef.current) {
                            inputRef.current.focus();
                        }
                    }} 
                />
                <img src={loggeduser?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
                <form onSubmit={handleSubmit} className="flex w-full gap-2">
                    <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Write a comment..." 
                        className="flex-1 text-sm border border-[var(--border-color)] rounded-full px-3 py-2 outline-none bg-[var(--surface-2)] text-[var(--text-main)] focus:border-[#808bf5]"
                        name="content" 
                        value={formData.content} 
                        onChange={e => {
                            setFormData({ content: e.target.value });
                            setCursorPosition(e.target.selectionStart);
                        }} 
                        onKeyUp={e => setCursorPosition(e.target.selectionStart)}
                        onSelect={e => setCursorPosition(e.target.selectionStart)}
                        onClick={e => setCursorPosition(e.target.selectionStart)}
                    />
                    <button type="submit" className="bg-[#808bf5] hover:bg-[#6b7ae6] text-white border-0 rounded-full px-4 py-2 cursor-pointer transition">
                        <i className="pi pi-send" style={{ fontSize: '14px' }}></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Comment;
