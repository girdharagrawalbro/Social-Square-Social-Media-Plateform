import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useStoryFeed, useUserDetails } from '../../hooks/queries/useAuthQueries';
import { Dialog } from 'primereact/dialog';
import { uploadToCloudinary, uploadVideoToCloudinary, validateImageFile } from '../../utils/cloudinary';

import { socket } from '../../socket';
import usePostStore from '../../store/zustand/usePostStore';
import LiveStream from './LiveStream';
import toast from 'react-hot-toast';
import ImageCropper from './ui/ImageCropper';

const UserProfile = React.lazy(() => import('./UserProfile'));
const PostDetail = React.lazy(() => import('./PostDetail'));

const StoryViewer = ({
    groups,
    startGroupIndex,
    onClose,
    loggeduser,
    onStoryDeleted,
    onStoryLiked,
    onOpenPostDetail,
    onShareStory,
    initialStoryId = null
}) => {
    const [groupIndex, setGroupIndex] = useState(startGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);
    const markGroupAsViewed = usePostStore(s => s.markGroupAsViewed);

    // If initialStoryId is provided, find its index in the current group
    useEffect(() => {
        if (initialStoryId && groups[groupIndex]) {
            const idx = groups[groupIndex].stories.findIndex(s => s._id === initialStoryId);
            if (idx !== -1) setStoryIndex(idx);
        }
    }, [initialStoryId, groupIndex, groups]);

    const group = groups[groupIndex];
    const story = group?.stories[storyIndex];
    const DURATION = story?.media?.type === 'video' ? 15000 : 5000;

    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);

    const [isPaused, setIsPaused] = useState(false);
    const [viewers, setViewers] = useState([]);
    const [viewersVisible, setViewersVisible] = useState(false);

    useEffect(() => {
        if (story) {
            setIsLiked(story.likes?.some(id => id.toString() === loggeduser?._id?.toString()));
            setLikesCount(story.likes?.length || 0);
        }
    }, [story, loggeduser?._id]);

    useEffect(() => {
        const handleStoryUpdate = ({ storyId, likes }) => {
            if (story?._id === storyId) {
                setLikesCount(likes.length);
                setIsLiked(likes.some(id => id.toString() === loggeduser?._id?.toString()));
            }
        };
        socket.on('storyUpdate', handleStoryUpdate);
        return () => socket.off('storyUpdate', handleStoryUpdate);
    }, [story?._id, loggeduser?._id]);

    const goNext = React.useCallback(() => {
        if (!group) return;
        if (storyIndex < group.stories.length - 1) setStoryIndex(s => s + 1);
        else {
            markGroupAsViewed(group.user._id);
            if (groupIndex < groups.length - 1) {
                setGroupIndex(g => g + 1);
                setStoryIndex(0);
            } else onClose();
        }
    }, [group, storyIndex, groupIndex, groups.length, onClose, markGroupAsViewed]);

    useEffect(() => {
        setProgress(0);
    }, [story?._id]);

    useEffect(() => {
        if (!story || isPaused) return;

        if (story._id && loggeduser?._id) {
            import('../../store/zustand/useAuthStore').then(({ api }) => {
                api.post(`/api/story/view/${story._id}`).catch(() => { });
            });
        }

        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(intervalRef.current);
                    goNext();
                    return 0;
                }
                return prev + (100 / (DURATION / 50));
            });
        }, 50);

        return () => clearInterval(intervalRef.current);

    }, [story?._id, story, DURATION, loggeduser?._id, goNext, isPaused]);

    const handleLike = async (e) => {
        e.stopPropagation();
        if (!story?._id) return;
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            const res = await api.post(`/api/story/like/${story._id}`);
            setLikesCount(res.data.likes.length);
            setIsLiked(res.data.likes.some(id => id.toString() === loggeduser?._id?.toString()));
            onStoryLiked(story._id, res.data.likes);
        } catch { toast.error('Failed to like story'); }
    };

    const goPrev = (e) => {
        e.stopPropagation();
        if (storyIndex > 0) setStoryIndex(s => s - 1);
        else if (groupIndex > 0) { setGroupIndex(g => g - 1); setStoryIndex(0); }
    };

    if (!story || !group) return null;
    const isOwn = group.user._id.toString() === loggeduser?._id?.toString();

    const handleDelete = async (e) => {
        e.stopPropagation();
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            await api.delete(`/api/story/${story._id}`);
            toast.success('Story deleted');
            onStoryDeleted(group.user._id.toString(), story._id);
            if (group.stories.length <= 1) {
                if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); }
                else onClose();
            } else { goNext(); }
        } catch { toast.error('Failed to delete'); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.38)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '450px', height: '100vh', maxHeight: '850px', backgroundColor: '#000', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                {/* Progress Bars */}
                <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: '6px', zIndex: 20 }}>
                    {group.stories.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: '2.5px', background: 'rgba(255,255,255,0.25)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#fff', width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%', transition: i === storyIndex ? 'width 0.05s linear' : 'none' }} />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div style={{ position: 'absolute', top: 28, left: 16, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.8)', flexShrink: 0 }}>
                            <img src={group.user.profile_picture || '/default-profile.png'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                            <p style={{ margin: 0, color: '#fff', fontSize: '14px', fontWeight: 600 }}>{group.user.fullname}</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                                {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && ` · ${story.viewers?.length || 0} views`}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {isOwn && (
                            <button onClick={handleDelete} title='Delete' style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(5px)', border: 'none', color: '#fff', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                <i className="pi pi-trash" style={{ fontSize: '14px' }}></i>
                            </button>
                        )}
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(5px)', border: 'none', color: '#fff', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                            <i className="pi pi-times" style={{ fontSize: '16px' }}></i>
                        </button>
                    </div>
                </div>

                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#1a1a1a' }}>
                    {story.media.type === 'video'
                        ? <video src={story.media.url} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <img src={story.media.url} alt="story" style={{ width: '100%', height: '100%', objectFit: story.sharedPostId ? 'cover' : 'contain', filter: story.sharedPostId ? 'blur(10px) brightness(0.6)' : 'none', opacity: story.sharedPostId ? 0.8 : 1 }} />
                    }

                    {/* Shared Post Overlay (Sticker) */}
                    {story.sharedPostId && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPaused(true);
                                onOpenPostDetail(story.sharedPostId._id);
                            }}
                            style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)',
                                padding: '12px', borderRadius: '24px',
                                width: '280px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', cursor: 'pointer',
                                display: 'flex', flexDirection: 'column', gap: '10px',
                                border: '1px solid rgba(255,255,255,0.3)',
                                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                            className="shared-post-sticker"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
                                <img
                                    src={story.sharedPostId.user?.profile_picture ? (story.sharedPostId.user.profile_picture.startsWith('http') ? story.sharedPostId.user.profile_picture : `${process.env.REACT_APP_BACKEND_URL}${story.sharedPostId.user.profile_picture}`) : '/default-profile.png'}
                                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #fff', objectFit: 'cover' }}
                                    alt=""
                                />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{story.sharedPostId.user?.fullname}</span>
                            </div>
                            {story.sharedPostId.image_url ? (
                                <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: '16px' }}>
                                    <img src={story.sharedPostId.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                </div>
                            ) : (
                                <div style={{ padding: '24px 16px', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', borderRadius: '16px', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600, textAlign: 'center', margin: 0, lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {story.sharedPostId.caption || 'Shared a post'}
                                    </p>
                                </div>
                            )}
                            {story.sharedPostId.image_url && story.sharedPostId.caption && (
                                <div style={{ padding: '0 4px' }}>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#374151', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {story.sharedPostId.caption}
                                    </p>
                                </div>
                            )}
                            <div style={{ marginTop: '4px', textAlign: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>View Post <i className="pi pi-chevron-right" style={{ fontSize: '8px' }}></i></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Overlay Text */}
                {story.text?.content && (
                    <div style={{ position: 'absolute', top: story.text.position === 'top' ? '25%' : story.text.position === 'bottom' ? '70%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: story.text.color || '#fff', fontSize: '24px', fontWeight: 800, textShadow: '0 4px 12px rgba(0,0,0,0.9)', textAlign: 'center', padding: '10px 20px', borderRadius: '12px', maxWidth: '85%', zIndex: 15 }}>
                        {story.text.content}
                    </div>
                )}

                {/* Interaction Overlay */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10 }}
                    onMouseDown={() => setIsPaused(true)}
                    onMouseUp={() => setIsPaused(false)}
                    onMouseLeave={() => setIsPaused(false)}
                    onTouchStart={() => setIsPaused(true)}
                    onTouchEnd={() => setIsPaused(false)}
                >
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={goPrev} />
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={goNext} />
                </div>

                {/* Footer / Interaction Bar */}
                <div style={{ position: 'absolute', bottom: 30, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: '15px', zIndex: 25 }}>
                    {isOwn ? (
                        <div
                            onClick={async () => {
                                setIsPaused(true);
                                try {
                                    const { api } = await import('../../store/zustand/useAuthStore');
                                    const res = await api.get(`/api/story/viewers/${story._id}`);
                                    setViewers(res.data);
                                    setViewersVisible(true);
                                } catch { toast.error('Failed to load viewers'); setIsPaused(false); }
                            }}
                            style={{ flex: 1, height: 44, borderRadius: '22px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', padding: '0 16px', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: 600 }}
                        >
                            <i className="pi pi-eye mr-2"></i>
                            {story.viewers?.length || 0} Views
                        </div>
                    ) : (
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const reply = e.target.reply.value;
                                if (!reply.trim() || !story?._id) return;
                                try {
                                    const { api } = await import('../../store/zustand/useAuthStore');
                                    await api.post(`/api/story/reply/${story._id}`, { content: reply });
                                    toast.success('Reply sent!');
                                    e.target.reply.value = '';
                                    setIsPaused(false);
                                } catch { toast.error('Failed to send reply'); }
                            }}
                            style={{ flex: 1, display: 'flex' }}
                        >
                            <div style={{ flex: 1, height: 44, borderRadius: '22px', border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                                <input
                                    name="reply"
                                    type="text"
                                    placeholder="Send message..."
                                    onFocus={() => setIsPaused(true)}
                                    onBlur={() => setIsPaused(false)}
                                    autoComplete="off"
                                    style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '13px', padding: '0 12px', outline: 'none' }}
                                />
                                <button type="submit" style={{ background: '#808bf5', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '2px' }}>
                                    <i className="pi pi-send" style={{ fontSize: '14px' }}></i>
                                </button>
                            </div>
                        </form>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <button onClick={handleLike} style={{ background: 'none', border: 'none', color: isLiked ? '#ff4b4b' : '#fff', cursor: 'pointer', height: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: isLiked ? 'scale(1.1)' : 'scale(1)' }}>
                            <i className={`pi ${isLiked ? 'pi-heart-fill' : 'pi-heart'}`} style={{ fontSize: '24px' }}></i>
                        </button>
                        {likesCount > 0 && <span style={{ color: '#fff', fontSize: '8px', fontWeight: 700 }}>{likesCount}</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <button
                            onClick={() => {
                                setIsPaused(true);
                                onShareStory(story);
                            }}
                            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', height: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <i className="pi pi-send" style={{ fontSize: '22px' }}></i>
                        </button>
                    </div>
                </div>

                {/* Viewers Overlay */}
                {viewersVisible && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '60px 20px 20px', animation: 'slideUp 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>Viewers ({viewers.length})</h3>
                            <button onClick={() => { setViewersVisible(false); setIsPaused(false); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {viewers.length === 0 ? (
                                <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '40px' }}>No views yet</p>
                            ) : viewers.map(v => (
                                <div key={v._id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src={v.profile_picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                    <div>
                                        <p style={{ color: '#fff', margin: 0, fontSize: '14px', fontWeight: 600 }}>{v.fullname}</p>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '12px' }}>@{v.username}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

const ShareStoryDialog = ({ visible, onHide, story, loggeduser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sendingUsers, setSendingUsers] = useState([]);

    // Use user's followers/following to share
    const followerIds = (loggeduser?.followers || []).map(f => f.toString());
    const followingIds = (loggeduser?.following || []).map(f => f.toString());
    const allUniqueIds = [...new Set([...followerIds, ...followingIds])];

    const { data: users = [], isLoading } = useUserDetails(allUniqueIds);

    const filteredUsers = users.filter(u =>
        u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const storyUrl = story?._id && story?.user?._id
        ? `${window.location.origin}/story/${story.user._id}/${story._id}`
        : '';

    const handleCopyLink = async () => {
        if (!storyUrl) return;
        try {
            await navigator.clipboard.writeText(storyUrl);
            toast.success('Story link copied');
        } catch {
            toast.error('Unable to copy link');
        }
    };

    const handleShare = async (targetUser) => {
        if (!story?._id || !targetUser?._id) return;
        setSendingUsers(prev => [...prev, targetUser._id]);
        try {
            // Include deep link so the recipient can open the exact story from outside chat too.
            const content = `Shared a story: ${storyUrl}`;

            // Create or get conversation
            const convRes = await api.post('/api/conversation/messages', { recipientId: targetUser._id });
            const conversationId = convRes.data.conversation?._id;

            if (conversationId) {
                await api.post('/api/conversation/send', {
                    conversationId,
                    recipientId: targetUser._id,
                    content,
                    storyReply: {
                        storyId: story._id,
                        mediaUrl: story.media?.url,
                        isShare: true
                    }
                });
                toast.success(`Shared with ${targetUser.fullname}`);
            }
        } catch (err) {
            console.error('Share failed', err);
            toast.error('Failed to share');
        } finally {
            setSendingUsers(prev => prev.filter(id => id !== targetUser._id));
        }
    };

    return (
        <Dialog
            header="Share Story"
            visible={visible}
            onHide={onHide}
            style={{ width: '95vw', maxWidth: '450px' }}
            breakpoints={{ '640px': '100vw' }}
            baseZIndex={20000}
            appendTo={document.body}
            modal
        >
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                </div>

                <button
                    onClick={handleCopyLink}
                    className="w-full py-2.5 bg-gray-100 border-0 rounded-xl cursor-pointer text-gray-700 font-semibold text-xs hover:bg-gray-200 transition"
                >
                    🔗 Copy Story Link
                </button>

                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse w-full mb-1" />)
                    ) : filteredUsers.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">No users found</p>
                    ) : filteredUsers.map(u => (
                        <div key={u._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition">
                            <div className="flex items-center gap-3">
                                <img src={u.profile_picture || '/default-profile.png'} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="" />
                                <div>
                                    <p className="m-0 text-sm font-semibold text-gray-800">{u.fullname}</p>
                                    <p className="m-0 text-[11px] text-gray-400">@{u.username}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleShare(u)}
                                disabled={sendingUsers.includes(u._id)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer shadow-sm transition-all ${sendingUsers.includes(u._id) ? 'bg-gray-100 text-gray-400' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
                            >
                                {sendingUsers.includes(u._id) ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </Dialog>
    );
};

const CreateStoryModal = ({ onClose, onCreated, loggeduser, sharedPost = null }) => {
    const fileInputRef = useRef(null);
    const [previews, setPreviews] = useState([]); // [{url, type, file}]
    const [currentIndex, setCurrentIndex] = useState(0);
    const [text, setText] = useState('');
    const [textColor, setTextColor] = useState('#ffffff');
    const [textPosition, setTextPosition] = useState('center');
    const [uploading, setUploading] = useState(false);
    const [croppingState, setCroppingState] = useState({ visible: false, imageSrc: null, pendingFiles: [] });

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const validVideos = [];
        const itemsToCrop = [];

        files.forEach(f => {
            const isVideo = f.type.startsWith('video/');
            if (isVideo) {
                validVideos.push({ url: URL.createObjectURL(f), type: 'video', file: f });
            } else {
                const err = validateImageFile(f);
                if (err) toast.error(err);
                else itemsToCrop.push(f);
            }
        });

        if (itemsToCrop.length > 0) {
            const first = itemsToCrop[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCroppingState({
                    visible: true,
                    imageSrc: reader.result,
                    pendingFiles: itemsToCrop.slice(1),
                    currentValidOnes: validVideos
                });
            };
            reader.readAsDataURL(first);
        } else {
            setPreviews(prev => [...prev, ...validVideos]);
        }
        e.target.value = '';
    };

    const handleCropComplete = (croppedFile) => {
        const newPreview = { url: URL.createObjectURL(croppedFile), type: 'image', file: croppedFile };

        if (croppingState.pendingFiles.length > 0) {
            const next = croppingState.pendingFiles[0];
            const reader = new FileReader();
            reader.onload = () => {
                setPreviews(prev => [...prev, newPreview]);
                setCroppingState({
                    ...croppingState,
                    imageSrc: reader.result,
                    pendingFiles: croppingState.pendingFiles.slice(1)
                });
            };
            reader.readAsDataURL(next);
        } else {
            setPreviews(prev => [...prev, ...(croppingState.currentValidOnes || []), newPreview]);
            setCroppingState({ visible: false, imageSrc: null, pendingFiles: [], currentValidOnes: [] });
        }
    };

    const removePreview = (idx) => {
        setPreviews(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[idx].url);
            updated.splice(idx, 1);
            return updated;
        });
        if (currentIndex >= previews.length - 1) setCurrentIndex(Math.max(0, previews.length - 2));
    };

    const handleSubmit = async () => {
        if (previews.length === 0 && !sharedPost) { toast.error('Please select an image or video'); return; }
        setUploading(true);
        try {
            const { api } = await import('../../store/zustand/useAuthStore');

            if (sharedPost) {
                // Special case for sharing a post
                const res = await api.post(`/api/story/create`, {
                    mediaUrl: sharedPost.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
                    mediaType: 'image',
                    text: text ? { content: text, color: textColor, position: textPosition } : { content: 'Tap to view post', color: '#ffffff', position: 'bottom' },
                    sharedPostId: sharedPost._id
                });
                onCreated(res.data);
            } else {
                for (const item of previews) {
                    let mediaUrl;
                    if (item.type === 'video') {
                        mediaUrl = await uploadVideoToCloudinary(item.file);
                    } else {
                        mediaUrl = await uploadToCloudinary(item.file);
                    }

                    const res = await api.post(`/api/story/create`, {
                        mediaUrl, mediaType: item.type,
                        text: text ? { content: text, color: textColor, position: textPosition } : null
                    });
                    onCreated(res.data);
                }
            }
            toast.success(sharedPost ? 'Post shared to story!' : `${previews.length} stories created!`);
            onClose();
        } catch { toast.error('Failed to create story'); }
        setUploading(false);
    };

    const currentMedia = previews[currentIndex];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.25)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface-1)', color: 'var(--text-main)', borderRadius: '16px', padding: '24px', width: '360px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Create Story {previews.length > 0 && `(${previews.length})`}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ position: 'relative', marginBottom: '16px' }}>
                    <div onClick={() => !sharedPost && fileInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '10px', textAlign: 'center', cursor: sharedPost ? 'default' : 'pointer', background: 'var(--surface-2)', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                        {sharedPost ? (
                            <div style={{ width: '100%', padding: '10px', background: 'var(--surface-1)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <img src={sharedPost.user?.profile_picture} style={{ width: 24, height: 24, borderRadius: '50%' }} alt="" />
                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{sharedPost.user?.fullname}</span>
                                </div>
                                {sharedPost.image_url && <img src={sharedPost.image_url} style={{ width: '100%', borderRadius: '8px', aspectRatio: '1/1', objectFit: 'cover' }} alt="" />}
                                <p style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }} className="truncate">{sharedPost.caption}</p>
                            </div>
                        ) : currentMedia ? (
                            currentMedia.type === 'video'
                                ? <video src={currentMedia.url} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'contain' }} controls />
                                : <img src={currentMedia.url} alt="" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'contain' }} />
                        ) : (
                            <div><p style={{ fontSize: '32px', margin: 0 }}>📷</p><p style={{ color: 'var(--text-sub)', fontSize: '13px', margin: '8px 0 0' }}>Tap to add photo or video</p></div>
                        )}
                        {(currentMedia || sharedPost) && text && (
                            <div style={{ position: 'absolute', top: textPosition === 'top' ? '15%' : textPosition === 'bottom' ? '75%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: textColor, fontSize: '18px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: 'none', width: '90%', textAlign: 'center', zIndex: 10 }}>
                                {text}
                            </div>
                        )}
                    </div>
                    {previews.length > 1 && (
                        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginTop: '8px', paddingBottom: '4px' }}>
                            {previews.map((p, i) => (
                                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                                    <img
                                        src={p.url}
                                        onClick={() => setCurrentIndex(i)}
                                        style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: i === currentIndex ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer' }}
                                        alt=""
                                    />
                                    <button onClick={(e) => { e.stopPropagation(); removePreview(i); }} style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                <input type="text" placeholder="Add text overlay (optional)" value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px', background: 'transparent', color: 'var(--text-main)' }} />
                {text && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'].map(color => (
                            <button key={color} onClick={() => setTextColor(color)} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: textColor === color ? '3px solid var(--primary)' : '2px solid var(--border-color)', cursor: 'pointer' }} />
                        ))}
                        <select value={textPosition} onChange={e => setTextPosition(e.target.value)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'transparent', color: 'var(--text-main)' }}>
                            <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
                        </select>
                    </div>
                )}
                <button onClick={handleSubmit} disabled={uploading || (previews.length === 0 && !sharedPost)} style={{ width: '100%', padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', opacity: (previews.length === 0 && !sharedPost) ? 0.6 : 1 }}>
                    {uploading ? 'Uploading...' : sharedPost ? 'Share Post to Story' : `Share ${previews.length > 1 ? previews.length + ' Stories' : 'Story'}`}
                </button>
            </div>
            {croppingState.visible && (
                <ImageCropper
                    image={croppingState.imageSrc}
                    visible={croppingState.visible}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setCroppingState({ visible: false, imageSrc: null, pendingFiles: [] })}
                />
            )}
        </div>
    );
};

const Stories = () => {
    const queryClient = useQueryClient();
    const loggeduser = useAuthStore(s => s.user);
    const { data: storyFeed } = useStoryFeed(loggeduser?._id);
    const [groups, setGroups] = useState([]);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
    const [createOpen, setCreateOpen] = useState(false);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [postVisible, setPostVisible] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [sharingStory, setSharingStory] = useState(null);
    const [initialStoryId, setInitialStoryId] = useState(null);
    const { markGroupAsViewed, sharingPostToStory, clearSharingPostToStory, viewedStoryGroups, storyDetailUserId, storyDetailStoryId, setStoryDetailDeepLink, liveStreamId, isLiveHost, setLiveStream, clearLiveStream, setIsStoryViewerOpen } = usePostStore();
    const [activeLiveStreams, setActiveLiveStreams] = useState([]);

    // ✅ Sync story feed to local groups state
    useEffect(() => {
        if (storyFeed) {
            setGroups(storyFeed);
        }
    }, [storyFeed]);

    // ✅ Global trigger for viewing stories (from chat links, etc)
    useEffect(() => {
        window.onViewStory = (userId, storyId) => {
            const index = groups.findIndex(g => g?.user?._id?.toString() === userId?.toString());
            if (index !== -1) {
                setViewerGroupIndex(index);
                setInitialStoryId(storyId || null);
                setViewerOpen(true);
                setIsStoryViewerOpen(true);
            } else {
                toast.error('Story no longer available');
            }
        };
        return () => delete window.onViewStory;
    }, [groups, setIsStoryViewerOpen]);

    const fetchActiveLives = async () => {
        try {
            const { data } = await api.get('/api/live/active');
            setActiveLiveStreams(data);
        } catch (err) {
            console.error('Error fetching lives:', err);
        }
    };

    useEffect(() => {
        fetchActiveLives();
        const interval = setInterval(fetchActiveLives, 30000); // Polling for now
        return () => clearInterval(interval);
    }, []);

    const handleGoLive = async () => {
        try {
            const { data } = await api.post('/api/live/start', { title: `${loggeduser.fullname}'s Live` });
            setLiveStream(data._id, true);
        } catch (err) {
            toast.error('Could not start live stream');
        }
    };

    useEffect(() => {
        if (storyDetailUserId && groups.length > 0) {
            const index = groups.findIndex(g => g.user._id.toString() === storyDetailUserId.toString());
            if (index !== -1) {
                setViewerGroupIndex(index);
                setInitialStoryId(storyDetailStoryId || null);
                setViewerOpen(true);
                setIsStoryViewerOpen(true);
            }
            // Clear the selection so it doesn't trigger again
            setStoryDetailDeepLink(null, null);
        }
    }, [storyDetailUserId, storyDetailStoryId, groups, setStoryDetailDeepLink, setIsStoryViewerOpen]);

    // ✅ Real-time: new story from a followed user
    useEffect(() => {
        const handleNewStory = (story) => {
            const storyUserId = story.user._id.toString();
            if (storyUserId === loggeduser?._id?.toString()) return; // skip own
            setGroups(prev => {
                const idx = prev.findIndex(g => g.user._id.toString() === storyUserId);
                if (idx !== -1) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, story], hasUnviewed: true };
                    return updated;
                }
                return [...prev, { user: story.user, stories: [story], hasUnviewed: true }];
            });
        };
        const handleStoryUpdate = ({ storyId, likes }) => {
            setGroups(prev => prev.map(g => ({
                ...g,
                stories: g.stories.map(s => s._id === storyId ? { ...s, likes } : s)
            })));
        };
        socket.on('newStory', handleNewStory);
        socket.on('storyUpdate', handleStoryUpdate);
        return () => {
            socket.off('newStory', handleNewStory);
            socket.off('storyUpdate', handleStoryUpdate);
        };
    }, [loggeduser?._id]);

    const handleStoryLiked = (storyId, likes) => {
        setGroups(prev => prev.map(g => ({
            ...g,
            stories: g.stories.map(s => s._id === storyId ? { ...s, likes } : s)
        })));
    };

    const handleStoryDeleted = (userId, storyId) => {
        setGroups(prev =>
            prev.map(g => g.user._id.toString() === userId
                ? { ...g, stories: g.stories.filter(s => s._id !== storyId) }
                : g
            ).filter(g => g.stories.length > 0)
        );
    };

    const handleStoryCreated = (newStory) => {
        const myId = loggeduser?._id?.toString();
        let groupIndex = -1;

        // Optimistically update the list
        setGroups(prev => {
            const idx = prev.findIndex(g => g.user._id.toString() === myId);
            if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, newStory] };
                groupIndex = idx;
                return updated;
            }
            groupIndex = 0;
            return [{ user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }, stories: [newStory], hasUnviewed: false }, ...prev];
        });

        // If this is a shared story, open it in viewer
        if (sharingPostToStory && groupIndex !== -1) {
            setViewerGroupIndex(groupIndex);
            setInitialStoryId(newStory._id);
            setViewerOpen(true);
            setIsStoryViewerOpen(true);
            clearSharingPostToStory();
        }

        // Refetch in background, but we already updated local state
        queryClient.invalidateQueries(['story-feed']);
    };

    const openViewer = (index) => {
        const group = groups[index];
        if (group) markGroupAsViewed(group.user._id);
        setViewerGroupIndex(index);
        setViewerOpen(true);
        setIsStoryViewerOpen(true);
    };

    const handleProfileClick = (e, userId) => {
        e.stopPropagation();
        setSelectedProfileId(userId);
        setProfileVisible(true);
    };

    const ownGroup = groups.find(g => g.user._id.toString() === loggeduser?._id?.toString());
    const otherGroups = groups.filter(g => g.user._id.toString() !== loggeduser?._id?.toString());

    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        if (!scrollRef.current) return;
        setCanScrollLeft(scrollRef.current.scrollLeft > 0);
        setCanScrollRight(
            scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 5
        );
    };

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (el) el.addEventListener('scroll', checkScroll);
        return () => el?.removeEventListener('scroll', checkScroll);
    }, [groups]);

    const scroll = (direction) => {
        if (!scrollRef.current) return;
        const width = 300;
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -width : width,
            behavior: 'smooth'
        });
    };

    return (
        <>
            <div className="relative group story-list-container">
                <div
                    ref={scrollRef}
                    style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '12px 4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    className="no-scrollbar"
                >
                    {/* Go Live Button */}
                    {/* <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }} onClick={handleGoLive}>
                        <div style={{ width: 89, height: 89, borderRadius: '50%', border: '3px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)' }}>
                            <i className="pi pi-video" style={{ color: '#ef4444', fontSize: '32px' }}></i>
                        </div>
                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Go Live</span>
                    </div> */}

                    {/* Active Live Streams */}
                    {/* {activeLiveStreams.map(live => (
                        <div key={live._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setLiveStream(live._id, false)}>
                            <div style={{ width: 89, height: 89, borderRadius: '50%', padding: '2px', background: '#ef4444', animation: 'pulse 2s infinite' }}>
                                <img src={live.host.profile_picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--surface-1)' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>LIVE</span>
                        </div>
                    ))} */}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
                        <div style={{ position: 'relative', width: 89, height: 89 }}>
                            <div
                                onClick={() => ownGroup ? openViewer(groups.findIndex(g => g.user._id.toString() === loggeduser?._id?.toString())) : setCreateOpen(true)}
                                style={{
                                    width: 89, height: 89, borderRadius: '50%', padding: '2px',
                                    background: ownGroup ? (viewedStoryGroups.has(loggeduser?._id?.toString()) ? 'var(--border-color)' : 'linear-gradient(135deg, #808bf5, #ec4899)') : 'var(--border-color)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--surface-1)' }}>
                                    <img
                                        src={loggeduser?.profile_picture}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                            </div>
                            <div
                                onClick={(e) => { e.stopPropagation(); setCreateOpen(true); }}
                                style={{ position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, background: '#808bf5', borderRadius: '50%', border: '2px solid var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 700, zIndex: 5 }}
                            >
                                +
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 500, textAlign: 'center', maxWidth: 89, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ownGroup ? 'Your story' : 'Add story'}
                        </span>
                    </div>
                    {otherGroups.map(group => {
                        const realIndex = groups.findIndex(g => g.user._id.toString() === group.user._id.toString());
                        const allViewed = !group.hasUnviewed || viewedStoryGroups.has(group.user._id.toString());
                        return (
                            <div key={group.user._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
                                <div
                                    onClick={() => openViewer(realIndex)}
                                    style={{ width: 89, height: 89, borderRadius: '50%', padding: '2px', background: allViewed ? 'var(--border-color)' : 'linear-gradient(135deg, #808bf5, #ec4899)', transition: 'all 0.3s ease', flexShrink: 0 }}
                                >
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--surface-1)' }}>
                                        <img
                                            src={group.user.profile_picture}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                </div>
                                <span
                                    onClick={(e) => handleProfileClick(e, group.user._id)}
                                    style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: allViewed ? 400 : 600, textAlign: 'center', maxWidth: 89, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                    {group.user.fullname.split(' ')[0]}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Left/Right Buttons */}
                {canScrollLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white w-8 h-8 rounded-full border-0 cursor-pointer shadow-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center p-0"
                    >
                        <i className="pi pi-chevron-left text-sm"></i>
                    </button>
                )}
                {canScrollRight && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white w-8 h-8 rounded-full border-0 cursor-pointer shadow-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center p-0"
                    >
                        <i className="pi pi-chevron-right text-sm"></i>
                    </button>
                )}

                <style>{`
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}</style>
            </div>
            {viewerOpen && groups.length > 0 && (
                <StoryViewer
                    groups={groups}
                    startGroupIndex={Math.min(viewerGroupIndex, groups.length - 1)}
                    onClose={() => {
                        setViewerOpen(false);
                        setInitialStoryId(null);
                        setIsStoryViewerOpen(false);
                    }}
                    loggeduser={loggeduser}
                    onStoryDeleted={handleStoryDeleted}
                    onStoryLiked={handleStoryLiked}
                    onOpenPostDetail={(id) => {
                        setSelectedPostId(id);
                        setPostVisible(true);
                    }}
                    onShareStory={(s) => {
                        setSharingStory(s);
                        setShareOpen(true);
                    }}
                    initialStoryId={initialStoryId}
                />
            )}
            {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={handleStoryCreated} loggeduser={loggeduser} />}
            {sharingPostToStory && (
                <CreateStoryModal
                    onClose={clearSharingPostToStory}
                    onCreated={handleStoryCreated}
                    loggeduser={loggeduser}
                    sharedPost={sharingPostToStory}
                />
            )}

            <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }} onHide={() => setProfileVisible(false)} baseZIndex={20000} appendTo={document.body}>
                <React.Suspense fallback={<div className="p-4 text-center">Loading Profile...</div>}>
                    <UserProfile id={selectedProfileId} onClose={() => { setProfileVisible(false); setViewerOpen(false); if (typeof setIsStoryViewerOpen === 'function') setIsStoryViewerOpen(false); }} />
                </React.Suspense>
            </Dialog>

            <Dialog header="Post Details" visible={postVisible} style={{ width: '95vw', maxWidth: '700px' }} onHide={() => setPostVisible(false)} baseZIndex={20000} appendTo={document.body}>
                <React.Suspense fallback={<div className="p-4 text-center">Loading Post...</div>}>
                    <PostDetail postId={selectedPostId} onHide={() => setPostVisible(false)} />
                </React.Suspense>
            </Dialog>

            <ShareStoryDialog
                visible={shareOpen}
                onHide={() => setShareOpen(false)}
                story={sharingStory}
                loggeduser={loggeduser}
            />

            {liveStreamId && (
                <LiveStream
                    streamId={liveStreamId}
                    isHost={isLiveHost}
                    onClose={clearLiveStream}
                />
            )}
        </>
    );
};

// Export StoryViewer so other components can open the same viewer in a modal
export { StoryViewer };

export default Stories;