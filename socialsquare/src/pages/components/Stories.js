import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useStoryFeed, useUserDetails } from '../../hooks/queries/useAuthQueries';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import { uploadToCloudinary, uploadVideoToCloudinary, validateImageFile } from '../../utils/cloudinary';

import { socket } from '../../socket';
import usePostStore from '../../store/zustand/usePostStore';
import LiveStream from './LiveStream';
import toast from 'react-hot-toast';
import ImageCropper from './ui/ImageCropper';
import ProgressiveImage from './ui/ProgressiveImage';
import { getMediaThumbnail } from '../../utils/mediaUtils';
import useWindowWidth from '../../hooks/useWindowWidth';

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
    initialStoryId = null,
    onIndexChange = () => { }
}) => {
    const navigate = useNavigate();
    const [groupIndex, setGroupIndex] = useState(startGroupIndex);
    const lastReportedIndex = useRef(startGroupIndex);

    // ✅ Sync internal state with external prop (e.g. from previews)
    useEffect(() => {
        setGroupIndex(startGroupIndex);
        lastReportedIndex.current = startGroupIndex;
    }, [startGroupIndex]);

    useEffect(() => {
        if (groupIndex !== lastReportedIndex.current) {
            onIndexChange(groupIndex);
            lastReportedIndex.current = groupIndex;
        }
    }, [groupIndex, onIndexChange]);

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

    const [isPaused, setIsPaused] = useState(false);
    const [viewers, setViewers] = useState([]);
    const [viewersVisible, setViewersVisible] = useState(false);

    useEffect(() => {
        if (story) {
            setIsLiked(story.likes?.some(id => id.toString() === loggeduser?._id?.toString()));
        }
    }, [story, loggeduser?._id]);

    useEffect(() => {
        const handleStoryUpdate = ({ storyId, likes }) => {
            if (story?._id === storyId) {
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
        // ✅ Sync URL with current story
        if (group?.user) {
            const target = group.user.username || group.user._id;
            const path = `/stories/${target}${story?._id ? `/${story._id}` : ''}`;
            if (window.location.pathname !== path) {
                navigate(path, { replace: true });
            }
        }
    }, [story?._id, group?.user, navigate]);

    // ✅ Pre-fetching Logic
    useEffect(() => {
        if (!group) return;
        let nextStory = null;

        // Next story in current group?
        if (storyIndex < group.stories.length - 1) {
            nextStory = group.stories[storyIndex + 1];
        }
        // Or first story in next group?
        else if (groupIndex < groups.length - 1) {
            nextStory = groups[groupIndex + 1].stories[0];
        }

        if (nextStory && nextStory.media?.url) {
            if (nextStory.media.type === 'image') {
                const img = new Image();
                img.src = nextStory.media.url;
            } else if (nextStory.media.type === 'video') {
                const video = document.createElement('video');
                video.src = nextStory.media.url;
                video.preload = 'auto';
            }
        }
    }, [storyIndex, groupIndex, group, groups]);

    const viewedRef = useRef(new Set());

    useEffect(() => {
        if (!story || isPaused) return;

        // Record view only once per story per viewer session
        if (story._id && loggeduser?._id && !viewedRef.current.has(story._id)) {
            viewedRef.current.add(story._id);
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

    }, [story, DURATION, loggeduser?._id, goNext, isPaused]);

    const handleLike = async (e) => {
        e.stopPropagation();
        if (!story?._id) return;
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            const res = await api.post(`/api/story/like/${story._id}`);
            setIsLiked(res.data.likes.some(id => id.toString() === loggeduser?._id?.toString()));
            onStoryLiked(story._id, res.data.likes);
        } catch { toast.error('Failed to like story'); }
    };

    const goPrev = (e) => {
        if (e) e.stopPropagation();
        if (storyIndex > 0) setStoryIndex(s => s - 1);
        else if (groupIndex > 0) {
            setGroupIndex(g => g - 1);
            // Move to the last story of the previous group
            const prevGroup = groups[groupIndex - 1];
            if (prevGroup) {
                setStoryIndex(prevGroup.stories.length - 1);
            }
        }
    };

    const goToNextGroup = (e) => {
        if (e) e.stopPropagation();
        if (groupIndex < groups.length - 1) {
            setGroupIndex(g => g + 1);
            setStoryIndex(0);
        } else {
            onClose();
        }
    };

    const goToPrevGroup = (e) => {
        if (e) e.stopPropagation();
        if (groupIndex > 0) {
            setGroupIndex(g => g - 1);
            setStoryIndex(0);
        }
    };

    if (!story || !group) return null;
    const isOwn = group.user._id.toString() === loggeduser?._id?.toString();

    const handleDelete = (e) => {
        e.stopPropagation();
        setIsPaused(true);
        confirmDialog({
            message: 'Are you sure you want to delete this story?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: confirmDelete,
            reject: () => setIsPaused(false),
            onHide: () => setIsPaused(false)
        });
    };

    const confirmDelete = async () => {
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            await api.delete(`/api/story/${story._id}`);
            toast.success('Story deleted');
            onStoryDeleted(group.user._id.toString(), story._id);
            if (group.stories.length <= 1) {
                if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); }
                else onClose();
            } else { goNext(); }
        } catch {
            toast.error('Failed to delete');
            setIsPaused(false);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#030303', overflow: 'hidden' }}>
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
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={group.user.profile_picture || '/default-profile.png'} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                </div>
            </div>

            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#1a1a1a' }}>
                {story.media.type === 'video'
                    ? <video src={story.media.url} poster={story.media.thumbnailUrl || getMediaThumbnail(story.media.url, 'video')} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <ProgressiveImage
                        src={story.media.url}
                        alt="story"
                        objectFit={story.sharedPostId ? 'cover' : 'contain'}
                        placeholderColor="#111"
                        blurIntensity="10px"
                        style={{
                            filter: story.sharedPostId ? 'blur(100px) brightness(0.6)' : 'none',
                            opacity: story.sharedPostId ? 0.8 : 1,
                            background: '#030303'
                        }}
                    />
                }

                {/* Left/Right Group Navigation Arrows */}
                {groupIndex > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setGroupIndex(g => g - 1); setStoryIndex(0); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white w-10 h-10 rounded-full border-0 cursor-pointer flex items-center justify-center transition-all"
                    >
                        <i className="pi pi-chevron-left" style={{ fontSize: '18px' }}></i>
                    </button>
                )}
                {groupIndex < groups.length - 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setGroupIndex(g => g + 1); setStoryIndex(0); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white w-10 h-10 rounded-full border-0 cursor-pointer flex items-center justify-center transition-all"
                    >
                        <i className="pi pi-chevron-right" style={{ fontSize: '18px' }}></i>
                    </button>
                )}

                {/* Shared Post Overlay (Sticker) */}
                {story.sharedPostId && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPaused(true);
                            const pid = story.sharedPostId?._id || story.sharedPostId?.id || story.sharedPostId;
                            if (pid) onOpenPostDetail(pid);
                        }}
                        style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            background: 'rgba(255, 255, 255, 0.95)',
                            padding: '12px', borderRadius: '20px',
                            width: '310px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', gap: '8px',
                            border: '1px solid rgba(255,255,255,0.4)',
                            zIndex: 100,
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        className="shared-post-sticker hover:scale-[1.02]"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px' }}>
                            <img
                                src={story.sharedPostId.user?.profile_picture || '/default-profile.png'}
                                style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                alt=""
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#000', letterSpacing: '-0.3px' }}>{story.sharedPostId.user?.fullname}</span>
                                <span style={{ fontSize: '10px', color: '#666', marginTop: '-2px' }}>Social Square Post</span>
                            </div>
                            <i className="pi pi-instagram ml-auto text-gray-400" style={{ fontSize: '12px' }}></i>
                        </div>

                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.05)' }}>
                            {(story.sharedPostId.image_urls?.[0] || story.sharedPostId.image_url) ? (
                                <ProgressiveImage
                                    src={story.sharedPostId.image_urls?.[0] || story.sharedPostId.image_url}
                                    style={{ width: '100%', height: '100%' }}
                                    alt=""
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #808bf5, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} />
                            )}
                        </div>
                        <div style={{ padding: '4px 6px 6px' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#1f2937', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                                {story.sharedPostId.caption}
                            </p>
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

            {/* ✅ Neighbor Navigation Buttons (Visible on Desktop) */}
            <div className="hidden md:flex" style={{ position: 'absolute', top: '50%', left: '-80px', right: '-80px', transform: 'translateY(-50%)', justifyContent: 'space-between', zIndex: 40, pointerEvents: 'none' }}>
                <button
                    onClick={goToPrevGroup}
                    disabled={groupIndex === 0}
                    style={{
                        pointerEvents: 'auto',
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        cursor: groupIndex === 0 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        opacity: groupIndex === 0 ? 0.3 : 1
                    }}
                    className="hover:scale-110 hover:bg-white/20 active:scale-95"
                >
                    <i className="pi pi-chevron-left" style={{ fontSize: '20px' }}></i>
                </button>
                <button
                    onClick={goToNextGroup}
                    disabled={groupIndex === groups.length - 1}
                    style={{
                        pointerEvents: 'auto',
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        cursor: groupIndex === groups.length - 1 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        opacity: groupIndex === groups.length - 1 ? 0.3 : 1
                    }}
                    className="hover:scale-110 hover:bg-white/20 active:scale-95"
                >
                    <i className="pi pi-chevron-right" style={{ fontSize: '20px' }}></i>
                </button>
            </div>

            {/* Footer / Interaction Bar */}
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', gap: '4px', zIndex: 25 }}>
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
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPaused(true);
                            if (typeof onShareStory === 'function') {
                                onShareStory(story);
                            }
                        }}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', height: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Share Story"
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
                        ) : viewers.map(v => {
                            const hasLiked = story.likes?.some(likeId => likeId.toString() === v._id.toString());
                            return (
                                <div key={v._id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src={v.profile_picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ color: '#fff', margin: 0, fontSize: '14px', fontWeight: 600 }}>{v.fullname}</p>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '12px' }}>@{v.username}</p>
                                    </div>
                                    {hasLiked && (
                                        <i className="pi pi-heart-fill" style={{ color: '#ff4b4b', fontSize: '18px' }} title="Liked story"></i>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
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

    const storyUrl = story?._id && (story?.user?.username || story?.user?._id)
        ? `${window.location.origin}/stories/${story.user.username || story.user._id}/${story._id}`
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

            // Create or get conversation
            const convRes = await api.post('/api/conversation/messages', { recipientId: targetUser._id });
            const conversationId = convRes.data.conversation?._id;

            if (conversationId) {
                await api.post('/api/conversation/send', {
                    conversationId,
                    recipientId: targetUser._id,
                    content: "You sent an attachment",
                    storyReply: {
                        storyId: story._id,
                        mediaUrl: story.media?.url,
                        mediaType: story.media?.type,
                        authorName: story.user?.fullname || 'Someone',
                        authorUsername: story.user?.username || story.user?.fullname?.toLowerCase()?.replace(/\s+/g, '_') || 'user',
                        authorProfilePicture: story.user?.profile_picture,
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
            baseZIndex={150000}
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
                        <p className="text-center py-8 text-gray-400 text-sm font-medium">No users there</p>
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
        let uploadToast = null;
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            uploadToast = toast.loading("Uploading story...");
            if (sharedPost) {
                // Special case for sharing a post
                const mediaUrl = sharedPost.image_urls?.[0] || sharedPost.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80';
                const res = await api.post(`/api/story/create`, {
                    mediaUrl,
                    mediaType: 'image',
                    text: text ? { content: text, color: textColor, position: textPosition } : null,
                    sharedPostId: sharedPost._id
                });
                onCreated(res.data);
            } else {
                for (const item of previews) {
                    let mediaUrl, thumbnailUrl;
                    if (item.type === 'video') {
                        const result = await uploadVideoToCloudinary(item.file);
                        mediaUrl = typeof result === 'string' ? result : result?.url;
                        thumbnailUrl = result?.thumbnailUrl || null;
                    } else {
                        const result = await uploadToCloudinary(item.file);
                        mediaUrl = typeof result === 'string' ? result : result?.url;
                    }

                    const res = await api.post(`/api/story/create`, {
                        mediaUrl, mediaType: item.type,
                        thumbnailUrl,
                        text: text ? { content: text, color: textColor, position: textPosition } : null
                    });
                    onCreated(res.data);
                }
            }
            toast.success(sharedPost ? 'Post shared to story!' : `${previews.length} stories created!`, { id: uploadToast });
            onClose();
        } catch { toast.error('Failed to create story', { id: typeof uploadToast !== 'undefined' ? uploadToast : undefined }); }
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
                            <div style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.95)', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
                                    <img src={sharedPost.user?.profile_picture} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                    <span style={{ fontSize: '11px', fontWeight: 800 }}>{sharedPost.user?.fullname}</span>
                                </div>
                                {(sharedPost.image_urls?.[0] || sharedPost.image_url) && (
                                    <img src={sharedPost.image_urls?.[0] || sharedPost.image_url} style={{ width: '100%', borderRadius: '10px', aspectRatio: '1/1', objectFit: 'cover' }} alt="" />
                                )}
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
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const loggeduser = useAuthStore(s => s.user);
    const { data: storyFeed } = useStoryFeed(loggeduser?._id);
    const [groups, setGroups] = useState([]);
    const viewedRef = useRef(new Set());
    const [createOpen, setCreateOpen] = useState(false);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [postVisible, setPostVisible] = useState(false);
    const [selectedPostId] = useState(null);
    const { markGroupAsViewed, sharingPostToStory, clearSharingPostToStory, viewedStoryGroups, storyDetailUserId, storyDetailStoryId, setStoryDetailDeepLink, liveStreamId, isLiveHost, clearLiveStream, setIsStoryViewerOpen } = usePostStore();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;
    const isMobile = windowWidth < 640;
    const storySize = isMobile ? 64 : 89;

    useEffect(() => {
        if (storyFeed) {
            setGroups(storyFeed);
        }
    }, [storyFeed]);

    useEffect(() => {
        window.onViewStory = (userId, storyId) => {
            const group = groups.find(g => g?.user?._id?.toString() === userId?.toString());
            if (group) {
                navigate(`/stories/${group.user.username}${storyId ? `/${storyId}` : ''}`);
            } else {
                toast.error('Story no longer available');
            }
        };
        return () => delete window.onViewStory;
    }, [groups, navigate]);

    useEffect(() => {
        if (storyDetailUserId && groups.length > 0 && !viewedRef.current.has(storyDetailUserId)) {
            const group = groups.find(g => g.user._id.toString() === storyDetailUserId.toString());
            if (group) {
                viewedRef.current.add(storyDetailUserId);
                navigate(`/stories/${group.user.username}${storyDetailStoryId ? `/${storyDetailStoryId}` : ''}`);
            }
            setStoryDetailDeepLink(null, null);
        }
    }, [storyDetailUserId, storyDetailStoryId, groups, setStoryDetailDeepLink, navigate]);

    useEffect(() => {
        const handleNewStory = (story) => {
            const storyUserId = story.user._id.toString();
            if (storyUserId === loggeduser?._id?.toString()) return;
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

    const handleStoryCreated = (newStory) => {
        const myId = loggeduser?._id?.toString();
        let groupIndex = -1;

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

        if (sharingPostToStory && groupIndex !== -1) {
            const group = groups[groupIndex];
            if (group) {
                navigate(`/stories/${group.user.username}/${newStory._id}`);
            }
            clearSharingPostToStory();
        }

        queryClient.invalidateQueries(['story-feed']);
    };

    const openViewer = (index) => {
        const group = groups[index];
        if (group) {
            markGroupAsViewed(group.user._id);
            navigate(`/stories/${group.user.username}`);
        }
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
                        <div style={{ position: 'relative', width: storySize, height: storySize }}>
                            <div
                                onClick={() => ownGroup ? openViewer(groups.findIndex(g => g.user._id.toString() === loggeduser?._id?.toString())) : setCreateOpen(true)}
                                style={{
                                    width: storySize, height: storySize, borderRadius: '50%', padding: '2px',
                                    background: ownGroup ? ((!ownGroup.hasUnviewed || viewedStoryGroups.has(loggeduser?._id?.toString())) ? 'var(--border-color)' : 'linear-gradient(135deg, #808bf5, #ec4899)') : 'var(--border-color)',
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
                                style={{ position: 'absolute', bottom: isMobile ? 0 : 4, right: isMobile ? 0 : 4, width: isMobile ? 20 : 24, height: isMobile ? 20 : 24, background: '#808bf5', borderRadius: '50%', border: '2px solid var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: isMobile ? '14px' : '16px', fontWeight: 700, zIndex: 5 }}
                            >
                                <i className="pi pi-plus" style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: 'bold' }}></i>
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 500, textAlign: 'center', maxWidth: storySize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                                    style={{ position: 'relative', width: storySize, height: storySize, borderRadius: '50%', padding: '2px', background: allViewed ? 'var(--border-color)' : 'linear-gradient(135deg, #808bf5, #ec4899)', transition: 'all 0.3s ease', flexShrink: 0 }}
                                >
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--surface-1)' }} className={group.user.isOnline ? 'presence-glow' : ''}>
                                        <img
                                            src={group.user.profile_picture}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    {group.user.isOnline && <div className="presence-dot" style={{ width: isMobile ? 12 : 16, height: isMobile ? 12 : 16, border: '3px solid var(--surface-1)' }} />}
                                </div>
                                <span
                                    onClick={(e) => handleProfileClick(e, group.user._id)}
                                    style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: allViewed ? 400 : 600, textAlign: 'center', maxWidth: storySize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                    {group.user.fullname.split(' ')[0]}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {canScrollLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-white/80 dark:bg-black/60 hover:scale-110 text-gray-800 dark:text-white w-7 h-7 rounded-full border border-gray-200 dark:border-white/10 cursor-pointer shadow-lg transition-all flex items-center justify-center p-0"
                    >
                        <i className="pi pi-chevron-left text-[10px]"></i>
                    </button>
                )}
                {canScrollRight && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-white/80 dark:bg-black/60 hover:scale-110 text-gray-800 dark:text-white w-7 h-7 rounded-full border border-gray-200 dark:border-white/10 cursor-pointer shadow-lg transition-all flex items-center justify-center p-0"
                    >
                        <i className="pi pi-chevron-right text-[10px]"></i>
                    </button>
                )}

                <style>{`
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}</style>
            </div>
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
                    <UserProfile id={selectedProfileId} onClose={() => { setProfileVisible(false); if (typeof setIsStoryViewerOpen === 'function') setIsStoryViewerOpen(false); }} />
                </React.Suspense>
            </Dialog>

            <Dialog
                showHeader={false}
                visible={postVisible}
                style={{ width: isDesktop ? '95vw' : '100vw', maxWidth: isDesktop ? '1200px' : 'none', height: isDesktop ? '90vh' : '100dvh' }}
                onHide={() => setPostVisible(false)}
                dismissableMask
                blockScroll={true}
                closable={false}
                modal
                maskStyle={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
            >
                <div className="relative bg-[var(--surface-1)] h-full w-full shadow-2xl" style={{ borderRadius: isDesktop ? '24px' : '0', overflow: 'hidden', border: isDesktop ? '1px solid var(--border-color)' : 'none' }}>
                    <button
                        onClick={() => setPostVisible(false)}
                        className="absolute top-4 left-4 z-[20005] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg"
                    >
                        <i className="pi pi-times text-sm"></i>
                    </button>
                    <React.Suspense fallback={<div className="p-20 text-center text-[var(--text-sub)] bg-[var(--surface-1)]">
                        <div className="inline-block w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-medium">Loading Post...</p>
                    </div>}>
                        <PostDetail postId={selectedPostId} onHide={() => setPostVisible(false)} />
                    </React.Suspense>
                </div>
            </Dialog>


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

// Export components so other pages can use them
export { StoryViewer, ShareStoryDialog };

export default Stories;