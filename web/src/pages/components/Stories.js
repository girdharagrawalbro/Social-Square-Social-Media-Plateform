import React, { useState, useEffect, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useStoryFeed, useUserDetails } from '../../hooks/queries/useAuthQueries';
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { uploadMedia, uploadVideo, validateImageFile, validateImageType, validateVideoFile, validateVideoType } from '../../utils/cloudinary';
import dbService from '../../utils/indexedDb';
import useToastStore from '../../store/zustand/useToastStore';

import { socket } from '../../socket';
import usePostStore from '../../store/zustand/usePostStore';
import LiveStream from './LiveStream';
import toast from '../../utils/toast.js';
import ImageCropper from './ui/ImageCropper';
import ProgressiveImage from './ui/ProgressiveImage';
import { getMediaThumbnail } from '../../utils/mediaUtils';
import useWindowWidth from '../../hooks/useWindowWidth';
import { useSystemFlags } from '../../hooks/queries/useMiscQueries';
import MentionSuggestions from './ui/MentionSuggestions';
import { USER_DEFAULT_IMAGE } from '../../utils/constantMediaVariable';
import { appChannel } from '../../utils/broadcast';
import useBroadcast from '../../hooks/useBroadcast';

const UserProfile = React.lazy(() => import('./UserProfile'));
const PostDetail = React.lazy(() => import('./PostDetail'));

const AUDIO_PRESETS = [
    { title: 'Summer Lo-Fi Chill', artist: 'Lofi Dreamer', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { title: 'Synthwave Breeze', artist: 'Retro Waver', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { title: 'Inspiring Acoustic', artist: 'Acoustic Guitar Band', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { title: 'Sunset Chillout', artist: 'Sunset Groove', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
];

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
    const [isResharing, setIsResharing] = useState(false);

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
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

    useEffect(() => {
        if (story) {
            setIsLiked(story.likes?.some(id => id.toString() === loggeduser?._id?.toString()));
        }
    }, [story, loggeduser?._id]);

    const activeAudioRef = useRef(null);

    // Sync active background music
    useEffect(() => {
        const musicUrl = story?.music?.url;

        if (!musicUrl) {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
            return;
        }

        if (activeAudioRef.current && activeAudioRef.current.src !== musicUrl) {
            activeAudioRef.current.pause();
            activeAudioRef.current = null;
        }

        if (!activeAudioRef.current) {
            activeAudioRef.current = new Audio(musicUrl);
            activeAudioRef.current.loop = true;
            activeAudioRef.current.volume = 0.4;
        }

        if (isPaused) {
            activeAudioRef.current.pause();
        } else {
            activeAudioRef.current.play().catch(err => {
                console.log('Audio autoplay blocked by browser policy:', err);
            });
        }
    }, [story?._id, story?.music?.url, isPaused]);

    useEffect(() => {
        return () => {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
        };
    }, []);

    const handleVote = async (e, optionIndex) => {
        e.stopPropagation();
        if (!story?._id) return;
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            const res = await api.post(`/api/story/vote/${story._id}`, { optionIndex });
            onStoryLiked(story._id, undefined, res.data.poll);
            toast.success('Vote registered!');
        } catch (err) {
            console.error('Failed to vote:', err);
            toast.error('Failed to register vote');
        }
    };

    useEffect(() => {
        const handleStoryUpdate = ({ storyId, likes, poll }) => {
            if (story?._id === storyId) {
                if (likes !== undefined) {
                    setIsLiked(likes.some(id => id.toString() === loggeduser?._id?.toString()));
                }
                onStoryLiked(storyId, likes, poll);
            }
        };
        socket.on('storyUpdate', handleStoryUpdate);
        return () => socket.off('storyUpdate', handleStoryUpdate);
    }, [story?._id, loggeduser?._id, onStoryLiked]);

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

    const debouncedLike = useMemo(
        () => debounce(async (storyId) => {
            try {
                const { api } = await import('../../store/zustand/useAuthStore');
                const res = await api.post(`/api/story/like/${storyId}`);
                setIsLiked(res.data.likes?.some(id => id.toString() === loggeduser?._id?.toString()));
                onStoryLiked(storyId, res.data.likes);
            } catch { toast.error('Failed to like story'); }
        }, 400),
        [loggeduser?._id, onStoryLiked]
    );

    const handleLike = (e) => {
        e.stopPropagation();
        if (!story?._id) return;

        // Optimistic UI update
        setIsLiked(!isLiked);

        debouncedLike(story._id);
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
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = async () => {
        try {
            const { api } = await import('../../store/zustand/useAuthStore');
            await api.delete(`/api/story/${story._id}`);
            toast.success('Story deleted');
            onStoryDeleted(group.user._id.toString(), story._id);
            if (group.stories.length <= 1) {
                if (groupIndex < groups.length - 1) {
                    setGroupIndex(g => g + 1);
                    setStoryIndex(0);
                }
                else {
                    setTimeout(() => {
                        onClose();
                    }, 1000);
                }
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
                    <div
                        style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); setIsPaused(true); setSelectedProfileId(group.user._id); setProfileVisible(true); }}
                    >
                        <img src={group.user.profile_picture || USER_DEFAULT_IMAGE} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setIsPaused(true); setSelectedProfileId(group.user._id); setProfileVisible(true); }}>
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
                {story.media.type === 'video' ? (
                    <video
                        src={story.media.url}
                        poster={story.media.thumbnailUrl || getMediaThumbnail(story.media.url, 'video')}
                        autoPlay
                        playsInline
                        muted
                        loop
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: (story.sharedPostId || story.sharedStoryId) ? 'cover' : 'contain',
                            filter: (story.sharedPostId || story.sharedStoryId) ? 'blur(100px) brightness(0.6)' : 'none',
                            opacity: (story.sharedPostId || story.sharedStoryId) ? 0.8 : 1
                        }}
                    />
                ) : (
                    <ProgressiveImage
                        src={story.media.url}
                        alt="story"
                        objectFit={(story.sharedPostId || story.sharedStoryId) ? 'cover' : 'contain'}
                        placeholderColor="#111"
                        blurIntensity="10px"
                        style={{
                            filter: (story.sharedPostId || story.sharedStoryId) ? 'blur(100px) brightness(0.6)' : 'none',
                            opacity: (story.sharedPostId || story.sharedStoryId) ? 0.8 : 1,
                            background: '#030303'
                        }}
                    />
                )}

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
                                src={story.sharedPostId.user?.profile_picture || USER_DEFAULT_IMAGE}
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
                            {(story.sharedPostId.image_urls?.[0] || story.sharedPostId.image_url || story.sharedPostId.video) ? (
                                <ProgressiveImage
                                    src={story.sharedPostId.image_urls?.[0] || story.sharedPostId.image_url || getMediaThumbnail(story.sharedPostId.video, 'video')}
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

                {/* Shared Story Overlay (Sticker) */}
                {story.sharedStoryId && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPaused(true);
                            const originalUser = story.sharedStoryId.user?.username || story.sharedStoryId.user?._id;
                            if (originalUser) {
                                navigate(`/stories/${originalUser}/${story.sharedStoryId._id}`);
                            }
                        }}
                        style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            background: 'rgba(255, 255, 255, 0.95)',
                            padding: '12px', borderRadius: '20px',
                            width: '280px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', gap: '8px',
                            border: '1px solid rgba(255,255,255,0.4)',
                            zIndex: 100,
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        className="shared-story-sticker hover:scale-[1.02]"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px' }}>
                            <img
                                src={story.sharedStoryId.user?.profile_picture || USER_DEFAULT_IMAGE}
                                style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                alt=""
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#000', letterSpacing: '-0.3px' }}>{story.sharedStoryId.user?.fullname}</span>
                                <span style={{ fontSize: '10px', color: '#666', marginTop: '-2px' }}>Social Square Story</span>
                            </div>
                            <i className="pi pi-images ml-auto text-gray-400" style={{ fontSize: '12px' }}></i>
                        </div>

                        <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', overflow: 'hidden', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.05)' }}>
                            {story.sharedStoryId.media?.url ? (
                                story.sharedStoryId.media.type === 'video' ? (
                                    <video src={story.sharedStoryId.media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline autoPlay loop />
                                ) : (
                                    <ProgressiveImage
                                        src={story.sharedStoryId.media.url}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        alt=""
                                    />
                                )
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #808bf5, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                            )}

                            {/* Original story text overlay inside reshared story */}
                            {story.sharedStoryId.text?.content && (
                                <div style={{
                                    position: 'absolute',
                                    top: story.sharedStoryId.text.y !== undefined ? `${story.sharedStoryId.text.y}%` : (story.sharedStoryId.text.position === 'top' ? '25%' : story.sharedStoryId.text.position === 'bottom' ? '70%' : '50%'),
                                    left: story.sharedStoryId.text.x !== undefined ? `${story.sharedStoryId.text.x}%` : '50%',
                                    transform: 'translate(-50%, -50%)',
                                    color: story.sharedStoryId.text.color || '#fff',
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    textShadow: '0 2px 6px rgba(0,0,0,0.9)',
                                    textAlign: 'center',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    maxWidth: '85%',
                                    zIndex: 15,
                                    pointerEvents: 'none'
                                }}>
                                    {story.sharedStoryId.text.content}
                                </div>
                            )}

                            {/* Original story poll sticker inside reshared story */}
                            {story.sharedStoryId.poll && story.sharedStoryId.poll.question && (
                                <div style={{
                                    position: 'absolute',
                                    top: story.sharedStoryId.poll.y !== undefined ? `${story.sharedStoryId.poll.y}%` : '30%',
                                    left: story.sharedStoryId.poll.x !== undefined ? `${story.sharedStoryId.poll.x}%` : '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                    borderRadius: '10px',
                                    padding: '6px 8px',
                                    width: '140px',
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                                    zIndex: 10,
                                    pointerEvents: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    <div style={{
                                        fontSize: '8px',
                                        fontWeight: 800,
                                        color: '#333',
                                        textAlign: 'center',
                                        wordBreak: 'break-word',
                                        marginBottom: '2px'
                                    }}>
                                        {story.sharedStoryId.poll.question}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {story.sharedStoryId.poll.options?.map((opt, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    flex: 1,
                                                    height: '18px',
                                                    background: '#fff',
                                                    borderRadius: '6px',
                                                    fontSize: '7px',
                                                    fontWeight: 700,
                                                    color: '#808bf5',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1px solid rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                {opt.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Interactive Poll Sticker */}
                {story.poll && story.poll.question && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'absolute',
                            top: story.poll.y !== undefined ? `${story.poll.y}%` : '30%',
                            left: story.poll.x !== undefined ? `${story.poll.x}%` : '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '20px',
                            padding: '16px',
                            width: '290px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: '#fff',
                            textAlign: 'center',
                            wordBreak: 'break-word',
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            marginBottom: '4px'
                        }}>
                            {story.poll.question}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            {story.poll.options?.map((opt, idx) => {
                                const optVotes = opt.votes || [];
                                const optionVoted = optVotes.some(id => id.toString() === loggeduser?._id?.toString());
                                const totalVotes = story.poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
                                const percent = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0;
                                const userHasVoted = story.poll.options.some(o => o.votes?.some(id => id.toString() === loggeduser?._id?.toString()));

                                if (userHasVoted) {
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                flex: 1,
                                                height: '40px',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                border: optionVoted ? '2px solid #808bf5' : '1px solid rgba(255,255,255,0.2)',
                                                borderRadius: '12px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0 12px',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: `${percent}%`,
                                                background: optionVoted ? 'rgba(128, 139, 245, 0.45)' : 'rgba(255, 255, 255, 0.2)',
                                                transition: 'width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1)',
                                                zIndex: 1
                                            }} />
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: '#fff',
                                                zIndex: 2,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                marginRight: '4px'
                                            }}>
                                                {opt.text} {optionVoted && '✓'}
                                            </span>
                                            <span style={{
                                                fontSize: '12px',
                                                fontWeight: 800,
                                                color: optionVoted ? '#fff' : 'rgba(255,255,255,0.9)',
                                                zIndex: 2
                                            }}>
                                                {percent}%
                                            </span>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <button
                                            key={idx}
                                            onClick={(e) => handleVote(e, idx)}
                                            style={{
                                                flex: 1,
                                                height: '40px',
                                                background: '#fff',
                                                border: 'none',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: '#808bf5',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                            }}
                                            className="hover:scale-105 active:scale-95"
                                        >
                                            {opt.text}
                                        </button>
                                    );
                                }
                            })}
                        </div>
                    </div>
                )}

                {/* Background Music Spinning Disc Overlay */}
                {story.music?.url && (
                    <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        right: '16px',
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '30px',
                        padding: '6px 12px 6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        zIndex: 100,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        maxWidth: '220px',
                        pointerEvents: 'none'
                    }}>
                        <div
                            className={`music-disc-spinning ${isPaused ? 'music-disc-paused' : ''}`}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, #333 30%, #111 31%, #111 60%, #333 61%, #000 80%)',
                                border: '2px solid #fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                position: 'relative'
                            }}
                        >
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#808bf5',
                                border: '1px solid #fff'
                            }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#fff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                letterSpacing: '-0.2px'
                            }}>
                                {story.music.title}
                            </span>
                            <span style={{
                                fontSize: '9px',
                                color: 'rgba(255,255,255,0.7)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {story.music.artist}
                            </span>
                        </div>
                    </div>
                )}

                <style>{`
                    @keyframes music-disc-spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .music-disc-spinning {
                        animation: music-disc-spin 6s linear infinite;
                    }
                    .music-disc-paused {
                        animation-play-state: paused;
                    }
                `}</style>
            </div>

            {/* Overlay Text */}
            {story.text?.content && (
                <div style={{
                    position: 'absolute',
                    top: story.text.y !== undefined ? `${story.text.y}%` : (story.text.position === 'top' ? '25%' : story.text.position === 'bottom' ? '70%' : '50%'),
                    left: story.text.x !== undefined ? `${story.text.x}%` : '50%',
                    transform: 'translate(-50%, -50%)',
                    color: story.text.color || '#fff',
                    fontSize: '24px',
                    fontWeight: 800,
                    textShadow: '0 4px 12px rgba(0,0,0,0.9)',
                    textAlign: 'center',
                    padding: '10px 20px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    zIndex: 15
                }}>
                    {story.text.content}
                </div>
            )}

            {/* Tagged/Mentioned Users Overlay */}
            {story.mentions && story.mentions.length > 0 && (
                <div style={{ position: 'absolute', bottom: '80px', left: '16px', right: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px', zIndex: 16, pointerEvents: 'auto' }}>
                    {story.mentions.map((m, idx) => {
                        const uid = typeof m === 'object' ? m._id : m;
                        const name = typeof m === 'object' ? (m.username || m.fullname) : 'user';
                        if (!uid) return null;
                        return (
                            <button
                                key={uid}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPaused(true);
                                    setSelectedProfileId(uid);
                                    setProfileVisible(true);
                                }}
                                style={{
                                    background: 'rgba(0, 0, 0, 0.65)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                    color: '#fff',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-black/80 active:scale-95 animate-fade-in"
                            >
                                <i className="pi pi-user" style={{ fontSize: '9px' }}></i>
                                @{name}
                            </button>
                        );
                    })}
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
                                
                                const recipientId = group.user._id.toString();
                                const convRes = await api.post('/api/conversation/create', { recipientId });
                                const conversationId = convRes.data?._id;
                                
                                let finalContent = reply;
                                let isEncrypted = false;
                                
                                const useE2eeStore = (await import('../../store/zustand/useE2eeStore')).default;
                                const e2eeState = useE2eeStore.getState();
                                if (e2eeState.privateKey && conversationId) {
                                    const aesKey = await e2eeState.getConversationKey(conversationId, recipientId);
                                    if (aesKey) {
                                        const { encryptText } = await import('../../utils/cryptoUtils');
                                        const encrypted = await encryptText(reply, aesKey);
                                        finalContent = JSON.stringify(encrypted);
                                        isEncrypted = true;
                                    }
                                }
                                
                                await api.post(`/api/story/reply/${story._id}`, { content: finalContent, isEncrypted });
                                toast.success('Reply sent!');
                                e.target.reply.value = '';
                                setIsPaused(false);
                            } catch (err) { 
                                console.error(err);
                                toast.error('Failed to send reply'); 
                            }
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

            <Dialog
                header="Profile"
                visible={profileVisible}
                style={{ width: '95vw', maxWidth: '450px' }}
                onHide={() => { setProfileVisible(false); setIsPaused(false); }}
                breakpoints={{ '640px': '100vw' }}
                baseZIndex={2000000}
                dismissableMask
            >
                <React.Suspense fallback={<div className="p-4 text-center text-[var(--text-sub)]">Loading Profile...</div>}>
                    <UserProfile id={selectedProfileId} />
                </React.Suspense>
            </Dialog>
            {/* Mention-back / Reshare Button */}
            {!isOwn && story.mentions?.some(m => (m._id || m) === loggeduser?._id) && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsPaused(true);
                        setIsResharing(true);
                    }}
                    style={{
                        position: 'absolute',
                        bottom: '130px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(255, 255, 255, 0.25)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        zIndex: 30,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    className="hover:bg-white/40 active:scale-95 transition-all"
                >
                    ⚡ Add to your Story
                </button>
            )}

            {isResharing && (
                <CreateStoryModal
                    onClose={() => {
                        setIsResharing(false);
                        setIsPaused(false);
                    }}
                    onCreated={(newStory) => {
                        setIsResharing(false);
                        setIsPaused(false);
                        toast.success("Story reshared successfully!");
                    }}
                    loggeduser={loggeduser}
                    sharedStory={story}
                />
            )}
            <ConfirmDialog
                visible={deleteConfirmVisible}
                onHide={() => { setDeleteConfirmVisible(false); setIsPaused(false); }}
                message="Are you sure you want to delete this story?"
                header="Delete Confirmation"
                icon="pi pi-exclamation-triangle"
                accept={() => {
                    setDeleteConfirmVisible(false);
                    confirmDelete();
                }}
                reject={() => {
                    setDeleteConfirmVisible(false);
                    setIsPaused(false);
                }}
                baseZIndex={1100000}
            />
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
                    content: "sent an attachment",
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
                    🔗 Copy Link
                </button>

                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse w-full mb-1" />)
                    ) : filteredUsers.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm font-medium">No users there</p>
                    ) : filteredUsers.map(u => (
                        <div key={u._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition">
                            <div className="flex items-center gap-3">
                                <img src={u.profile_picture || USER_DEFAULT_IMAGE} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="" />
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

export const CreateStoryModal = ({ onClose, onCreated, loggeduser, sharedPost = null, sharedStory = null }) => {
    const fileInputRef = useRef(null);
    const textInputRef = useRef(null);
    const [previews, setPreviews] = useState([]); // [{url, type, file}]
    const [currentIndex, setCurrentIndex] = useState(0);
    const [text, setText] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [textColor, setTextColor] = useState('#ffffff');
    const [textPosition, setTextPosition] = useState('center');
    // eslint-disable-next-line no-unused-vars
    const [uploading, setUploading] = useState(false);
    const [croppingState, setCroppingState] = useState({ visible: false, imageSrc: null, pendingFiles: [] });
    const [visibility, setVisibility] = useState('public');

    // Tagged users (Direct Mentions)
    const [taggedUsers, setTaggedUsers] = useState([]);

    // Poll Sticker State
    const [hasPoll, setHasPoll] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOption1, setPollOption1] = useState('Yes');
    const [pollOption2, setPollOption2] = useState('No');

    // Music State
    const [selectedMusic, setSelectedMusic] = useState(null);
    const previewAudioRef = useRef(null);
    const [pollPos, setPollPos] = useState({ x: 50, y: 30 });
    const [textPos, setTextPos] = useState({ x: 50, y: 50 });
    const previewContainerRef = useRef(null);
    const [step, setStep] = useState(1);
    const [drafts, setDrafts] = useState([]);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [showDraftsListModal, setShowDraftsListModal] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    useEffect(() => {
        if (loggeduser?._id) {
            dbService.getDraft(`story_drafts_${loggeduser._id}`).then(async (saved) => {
                let list = Array.isArray(saved) ? saved : [];
                // Check for legacy single draft
                const legacy = await dbService.getDraft(`story_draft_${loggeduser._id}`);
                if (legacy) {
                    const newDraft = {
                        id: 'story_draft_' + Date.now(),
                        updatedAt: Date.now(),
                        ...legacy
                    };
                    list = [newDraft, ...list].slice(0, 3);
                    await dbService.setDraft(`story_drafts_${loggeduser._id}`, list);
                    await dbService.removeDraft(`story_draft_${loggeduser._id}`);
                }
                setDrafts(list);
            });
        }
    }, [loggeduser?._id]);

    useEffect(() => {
        if (sharedStory?.music) {
            setSelectedMusic(sharedStory.music);
        }
    }, [sharedStory]);

    const saveDraft = async (manual = false) => {
        if (!loggeduser?._id) return;
        if (!manual && !activeDraftId) return;
        if (previews.length === 0 && !text && !hasPoll && !selectedMusic) {
            // Don't save empty drafts
            return;
        }

        const draftData = {
            previews: previews.map(p => ({ file: p.file, type: p.type, url: p.url })),
            text,
            textColor,
            textPosition,
            visibility,
            taggedUsers,
            hasPoll,
            pollQuestion,
            pollOption1,
            pollOption2,
            selectedMusic,
            pollPos,
            textPos,
            step
        };

        try {
            const saved = await dbService.getDraft(`story_drafts_${loggeduser._id}`);
            let list = Array.isArray(saved) ? saved : [];

            let draftId = activeDraftId;
            if (draftId) {
                list = list.map(d => d.id === draftId ? { ...d, updatedAt: Date.now(), ...draftData } : d);
            } else {
                draftId = 'story_draft_' + Date.now();
                const newDraft = {
                    id: draftId,
                    updatedAt: Date.now(),
                    ...draftData
                };
                list = [newDraft, ...list].slice(0, 3);
                setActiveDraftId(draftId);
            }

            await dbService.setDraft(`story_drafts_${loggeduser._id}`, list);
            setDrafts(list);
            if (manual) {
                useToastStore.getState().show({ message: "Story saved in draft!", type: "success" });
            }
        } catch (e) {
            console.error("Failed to save story draft:", e);
        }
    };

    useEffect(() => {
        if (!loggeduser?._id) return;
        const timer = setTimeout(saveDraft, 1500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        loggeduser?._id,
        previews,
        text,
        textColor,
        textPosition,
        visibility,
        taggedUsers,
        hasPoll,
        pollQuestion,
        pollOption1,
        pollOption2,
        selectedMusic,
        pollPos,
        textPos,
        step,
        activeDraftId
    ]);

    const restoreDraft = async (draft) => {
        if (!draft) return;
        try {
            if (draft.previews) {
                setPreviews(draft.previews.map(p => ({
                    ...p,
                    url: p.file ? URL.createObjectURL(p.file) : p.url
                })));
            } else {
                setPreviews([]);
            }
            setText(draft.text || '');
            setTextColor(draft.textColor || '#ffffff');
            setTextPosition(draft.textPosition || 'center');
            setVisibility(draft.visibility || 'public');
            setTaggedUsers(draft.taggedUsers || []);
            setHasPoll(draft.hasPoll || false);
            setPollQuestion(draft.pollQuestion || '');
            setPollOption1(draft.pollOption1 || 'Yes');
            setPollOption2(draft.pollOption2 || 'No');
            setSelectedMusic(draft.selectedMusic || null);
            setPollPos(draft.pollPos || { x: 50, y: 30 });
            setTextPos(draft.textPos || { x: 50, y: 50 });
            setStep(draft.step || 1);
            setActiveDraftId(draft.id);
            useToastStore.getState().show({ message: "Story draft restored!", type: "success" });
        } catch (e) {
            console.error("Failed to restore story draft:", e);
        }
    };
    const deleteDraft = async (draftId) => {
        try {
            const saved = await dbService.getDraft(`story_drafts_${loggeduser._id}`);
            let list = Array.isArray(saved) ? saved : [];
            list = list.filter(d => d.id !== draftId);
            await dbService.setDraft(`story_drafts_${loggeduser._id}`, list);
            setDrafts(list);
            if (activeDraftId === draftId) {
                setActiveDraftId(null);
            }
            useToastStore.getState().show({ message: "Story draft deleted.", type: "success" });
        } catch (e) {
            console.error("Failed to delete story draft:", e);
        }
    };

    const handlePointerDown = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        const container = previewContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();

        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = type === 'poll' ? pollPos : textPos;

        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            const pctX = startPos.x + (deltaX / rect.width) * 100;
            const pctY = startPos.y + (deltaY / rect.height) * 100;

            const boundedX = Math.max(5, Math.min(95, pctX));
            const boundedY = Math.max(5, Math.min(95, pctY));

            if (type === 'poll') {
                setPollPos({ x: boundedX, y: boundedY });
            } else {
                setTextPos({ x: boundedX, y: boundedY });
            }
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    useEffect(() => {
        if (selectedMusic) {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
            }
            previewAudioRef.current = new Audio(selectedMusic.url);
            previewAudioRef.current.loop = true;
            previewAudioRef.current.volume = 0.4;
            previewAudioRef.current.play().catch(e => console.log('Audio preview block', e));
        } else {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        }
        return () => {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
            }
        };
    }, [selectedMusic]);
    const [tagSearchTerm, setTagSearchTerm] = useState("");
    const [tagSearchResults, setTagSearchResults] = useState([]);
    const [isSearchingTags, setIsSearchingTags] = useState(false);
    const [openTagPanel, setOpenTagPanel] = useState(false);

    const handleSearchTags = async (query) => {
        setTagSearchTerm(query);
        if (query.length < 2) { setTagSearchResults([]); return; }
        setIsSearchingTags(true);
        try {
            const res = await api.get(`/api/auth/search?query=${query}`);
            const users = res.data?.users || [];
            setTagSearchResults(users.filter(u => u._id !== loggeduser._id));
        } catch { }
        finally { setIsSearchingTags(false); }
    };

    const addTagUser = (user) => {
        if (taggedUsers.length >= 5) { toast.error("Max 5 tagged users"); return; }
        if (taggedUsers.some(c => c._id === user._id)) return;
        setTaggedUsers(prev => [...prev, user]);
        setTagSearchTerm("");
        setTagSearchResults([]);
    };

    const removeTagUser = (id) => {
        setTaggedUsers(prev => prev.filter(c => c._id !== id));
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const validVideos = [];
        const itemsToCrop = [];

        files.forEach(f => {
            const isVideo = f.type.startsWith('video/');
            if (isVideo) {
                const typeErr = validateVideoType(f);
                if (typeErr) { toast.error(typeErr); return; } // hard block: wrong type
                const sizeWarn = validateVideoFile(f);
                if (sizeWarn) toast.error(sizeWarn); // size warning but proceed
                validVideos.push({ url: URL.createObjectURL(f), type: 'video', file: f });
            } else {
                const typeErr = validateImageType(f);
                if (typeErr) { toast.error(typeErr); return; } // hard block: wrong type
                // Size warning — still proceed; uploadMedia falls back to Drive
                const sizeWarn = validateImageFile(f);
                if (sizeWarn) toast.error(sizeWarn);
                itemsToCrop.push(f);

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



    const handleCropComplete = ({ croppedFile }) => {
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
        if (previews.length === 0 && !sharedPost && !sharedStory) { toast.error('Please select an image or video'); return; }

        const previewsToUpload = [...previews];
        const sharedPostToUpload = sharedPost;
        const sharedStoryToUpload = sharedStory;
        const textToUpload = text;
        const textColorToUpload = textColor;
        const textPositionToUpload = textPosition;
        const tags = [...taggedUsers];

        setTimeout(() => {
            onClose();
        }, 1000);

        const uploadToast = toast.loading("Sharing story...", {
            position: 'bottom-right'
        });

        (async () => {
            try {
                const { api } = await import('../../store/zustand/useAuthStore');
                const pollData = hasPoll ? {
                    question: pollQuestion || "Ask a question...",
                    options: [
                        { text: pollOption1 || "Yes", votes: [] },
                        { text: pollOption2 || "No", votes: [] }
                    ],
                    x: pollPos.x,
                    y: pollPos.y
                } : null;

                const musicData = selectedMusic ? {
                    title: selectedMusic.title,
                    artist: selectedMusic.artist,
                    url: selectedMusic.url
                } : null;

                if (sharedPostToUpload) {
                    const mediaUrl = sharedPostToUpload.image_urls?.[0] || sharedPostToUpload.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80';
                    const res = await api.post(`/api/story/create`, {
                        mediaUrl,
                        mediaType: 'image',
                        text: textToUpload ? { content: textToUpload, color: textColorToUpload, position: textPositionToUpload, x: textPos.x, y: textPos.y } : null,
                        sharedPostId: sharedPostToUpload._id,
                        mentionIds: tags.map(t => t._id),
                        visibility,
                        poll: pollData,
                        music: musicData
                    });
                    onCreated(res.data);
                } else if (sharedStoryToUpload) {
                    const mediaUrl = sharedStoryToUpload.media?.url;
                    const mediaType = sharedStoryToUpload.media?.type || 'image';
                    const res = await api.post(`/api/story/create`, {
                        mediaUrl,
                        mediaType,
                        text: textToUpload ? { content: textToUpload, color: textColorToUpload, position: textPositionToUpload, x: textPos.x, y: textPos.y } : null,
                        sharedStoryId: sharedStoryToUpload._id,
                        mentionIds: tags.map(t => t._id),
                        visibility,
                        poll: pollData,
                        music: musicData
                    });
                    onCreated(res.data);
                } else {
                    for (const item of previewsToUpload) {
                        const batchId = Math.random().toString(36).substring(2, 10) + '-' + Date.now();
                        const folderPath = `stories/${batchId}`;
                        let mediaUrl, thumbnailUrl;
                        if (item.type === 'video') {
                            const result = await uploadVideo(item.file, null, { folder: folderPath });
                            mediaUrl = typeof result === 'string' ? result : result?.url;
                            thumbnailUrl = result?.thumbnailUrl || null;
                        } else {
                            const result = await uploadMedia(item.file, null, { folder: folderPath });
                            mediaUrl = typeof result === 'string' ? result : result?.url;
                        }

                        const res = await api.post(`/api/story/create`, {
                            mediaUrl, mediaType: item.type,
                            thumbnailUrl,
                            text: textToUpload ? { content: textToUpload, color: textColorToUpload, position: textPositionToUpload, x: textPos.x, y: textPos.y } : null,
                            mentionIds: tags.map(t => t._id),
                            visibility,
                            poll: pollData,
                            music: musicData
                        });
                        onCreated(res.data);
                    }
                }
                toast.success(sharedPostToUpload ? 'Post shared to story!' : `Story created!`, { id: uploadToast });
                if (activeDraftId) {
                    await deleteDraft(activeDraftId);
                }
            } catch (error) {
                toast.error('Failed to create story', { id: uploadToast });
            }
        })();
    };

    const handleCancel = () => {
        const hasContent = previews.length > 0 || text || hasPoll || selectedMusic;
        if (hasContent) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    };

    const currentMedia = previews[currentIndex];

    return (
        <>
            <Dialog
                visible={true}
                onHide={handleCancel}
                showHeader={true}
                header={step === 1 ? `Create Story ${previews.length > 0 ? `(${previews.length})` : ''}` : "Story Settings"}
                style={{ width: '95vw', maxWidth: '400px' }}
                modal
                dismissableMask={true}
                appendTo={document.body}
                baseZIndex={10000}
                draggable={false}
                resizable={false}
                contentStyle={{ padding: '10px', paddingTop: '0px', background: 'var(--surface-1)', borderRadius: '10px', borderTopRightRadius: '0px', borderTopLeftRadius: '0px' }}
            >
                <div className="flex flex-col">
                    {drafts.length > 0 && (
                        <div className="bg-[#808bf5]/10 border border-[#808bf5]/20 px-3 py-2 rounded-xl mb-3 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
                            <span className="text-[var(--text-main)] font-semibold flex items-center gap-1">
                                📝 Unsaved drafts ({drafts.length}/3)
                            </span>
                            <div className="flex gap-1.5">
                                <button onClick={() => setShowDraftsListModal(true)} className="bg-[#808bf5] text-white border-0 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer hover:opacity-95 transition">
                                    View Drafts
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <div
                            ref={previewContainerRef}
                            onClick={() => {
                                const hasContent = previews.length > 0 || sharedPost || sharedStory;
                                if (hasContent) {
                                    textInputRef.current?.focus();
                                } else {
                                    fileInputRef.current?.click();
                                }
                            }}
                            style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '10px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
                        >
                            {!sharedPost && !sharedStory && previews.length > 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                    style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        background: '#808bf5',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '20px',
                                        padding: '6px 12px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        zIndex: 50,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}
                                >
                                    <i className="pi pi-plus" style={{ fontSize: '9px' }}></i>
                                    Add
                                </button>
                            )}
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
                            ) : sharedStory ? (
                                <div style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.95)', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
                                        <img src={sharedStory.user?.profile_picture || USER_DEFAULT_IMAGE} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#000' }}>{sharedStory.user?.fullname}</span>
                                        <span style={{ fontSize: '9px', color: '#666', marginLeft: 'auto' }}>Story</span>
                                    </div>
                                    {sharedStory.media?.url && (
                                        <div style={{ position: 'relative', width: '100%', borderRadius: '10px', aspectRatio: '9/16', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
                                            {sharedStory.media.type === 'video' ? (
                                                <video src={sharedStory.media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline autoPlay loop />
                                            ) : (
                                                <img src={sharedStory.media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                            )}

                                            {/* Original story text caption overlay inside reshared story preview */}
                                            {sharedStory.text?.content && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: sharedStory.text.y !== undefined ? `${sharedStory.text.y}%` : (sharedStory.text.position === 'top' ? '25%' : sharedStory.text.position === 'bottom' ? '70%' : '50%'),
                                                    left: sharedStory.text.x !== undefined ? `${sharedStory.text.x}%` : '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    color: sharedStory.text.color || '#fff',
                                                    fontSize: '9px',
                                                    fontWeight: 800,
                                                    textShadow: '0 2px 6px rgba(0,0,0,0.9)',
                                                    textAlign: 'center',
                                                    padding: '2px 6px',
                                                    borderRadius: '6px',
                                                    maxWidth: '85%',
                                                    zIndex: 15,
                                                    pointerEvents: 'none'
                                                }}>
                                                    {sharedStory.text.content}
                                                </div>
                                            )}

                                            {/* Original story poll sticker inside reshared story preview */}
                                            {sharedStory.poll && sharedStory.poll.question && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: sharedStory.poll.y !== undefined ? `${sharedStory.poll.y}%` : '30%',
                                                    left: sharedStory.poll.x !== undefined ? `${sharedStory.poll.x}%` : '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    background: 'rgba(255, 255, 255, 0.9)',
                                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                                    borderRadius: '10px',
                                                    padding: '6px 8px',
                                                    width: '140px',
                                                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                                                    zIndex: 10,
                                                    pointerEvents: 'none',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px'
                                                }}>
                                                    <div style={{
                                                        fontSize: '8px',
                                                        fontWeight: 800,
                                                        color: '#333',
                                                        textAlign: 'center',
                                                        wordBreak: 'break-word',
                                                        marginBottom: '2px'
                                                    }}>
                                                        {sharedStory.poll.question}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {sharedStory.poll.options?.map((opt, idx) => (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    flex: 1,
                                                                    height: '18px',
                                                                    background: '#fff',
                                                                    borderRadius: '6px',
                                                                    fontSize: '7px',
                                                                    fontWeight: 700,
                                                                    color: '#808bf5',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    border: '1px solid rgba(0,0,0,0.05)'
                                                                }}
                                                            >
                                                                {opt.text}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : currentMedia ? (
                                currentMedia.type === 'video'
                                    ? <video src={currentMedia.url} style={{ width: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'contain' }} controls />
                                    : <img src={currentMedia.url} alt="" style={{ width: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'contain' }} />
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <p style={{ fontSize: '32px', margin: 0 }}>📸</p>
                                    <p style={{ color: 'var(--text-sub)', fontSize: '13px', margin: '8px 0 0' }}>Tap to add photo or video</p>
                                </div>
                            )}
                            {(currentMedia || sharedPost || sharedStory) && text && (
                                <div
                                    onPointerDown={(e) => handlePointerDown(e, 'text')}
                                    style={{
                                        position: 'absolute',
                                        top: `${textPos.y}%`,
                                        left: `${textPos.x}%`,
                                        transform: 'translate(-50%, -50%)',
                                        color: textColor,
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                        pointerEvents: 'auto',
                                        cursor: 'move',
                                        userSelect: 'none',
                                        touchAction: 'none',
                                        width: '90%',
                                        textAlign: 'center',
                                        zIndex: 10
                                    }}
                                >
                                    {text}
                                </div>
                            )}
                            {hasPoll && (
                                <div
                                    onPointerDown={(e) => handlePointerDown(e, 'poll')}
                                    style={{
                                        position: 'absolute',
                                        top: `${pollPos.y}%`,
                                        left: `${pollPos.x}%`,
                                        transform: 'translate(-50%, -50%)',
                                        background: 'rgba(255,255,255,0.95)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '14px',
                                        padding: '8px',
                                        width: '60%',
                                        zIndex: 12,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                        pointerEvents: 'auto',
                                        cursor: 'move',
                                        userSelect: 'none',
                                        touchAction: 'none',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        border: '1px solid rgba(255,255,255,0.3)'
                                    }}
                                >
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', textAlign: 'center', wordBreak: 'break-word', textShadow: 'none' }}>
                                        {pollQuestion || "Ask a question..."}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <div style={{ flex: 1, padding: '4px', background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#808bf5', textAlign: 'center' }}>
                                            {pollOption1 || "Yes"}
                                        </div>
                                        <div style={{ flex: 1, padding: '4px', background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: '#808bf5', textAlign: 'center' }}>
                                            {pollOption2 || "No"}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedMusic && (
                                <div style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', borderRadius: '20px', padding: '6px 12px', zIndex: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.15)', maxWidth: '90%' }}>
                                    <span style={{ fontSize: '10px' }}>🎵</span>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {selectedMusic.title} • {selectedMusic.artist}
                                    </div>
                                </div>
                            )}
                        </div>
                        {previews.length > 1 && (
                            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginTop: '8px', paddingBottom: '4px' }}>
                                {previews.map((p, i) => (
                                    <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                                        {p.type === 'video' ? (
                                            <video
                                                src={p.url}
                                                onClick={() => setCurrentIndex(i)}
                                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: i === currentIndex ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer' }}
                                            />
                                        ) : (
                                            <img
                                                src={p.url}
                                                onClick={() => setCurrentIndex(i)}
                                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: i === currentIndex ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer' }}
                                                alt=""
                                            />
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); removePreview(i); }} style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

                    {step === 1 && (
                        <>
                            <div style={{ position: 'relative' }}>
                                <MentionSuggestions
                                    text={text}
                                    cursorPosition={cursorPosition}
                                    onSelect={(val) => {
                                        setText(val);
                                        if (textInputRef.current) {
                                            textInputRef.current.focus();
                                        }
                                    }}
                                />
                                <input
                                    ref={textInputRef}
                                    type="text"
                                    placeholder="Add text overlay (optional)"
                                    value={text}
                                    onChange={e => {
                                        setText(e.target.value);
                                        setCursorPosition(e.target.selectionStart);
                                    }}
                                    onKeyUp={e => setCursorPosition(e.target.selectionStart)}
                                    onSelect={e => setCursorPosition(e.target.selectionStart)}
                                    onClick={e => setCursorPosition(e.target.selectionStart)}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px', background: 'transparent', color: 'var(--text-main)' }}
                                />
                            </div>
                            {text && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'].map(color => (
                                        <button key={color} onClick={() => setTextColor(color)} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: textColor === color ? '3px solid var(--primary)' : '2px solid var(--border-color)', cursor: 'pointer' }} />
                                    ))}
                                    <select value={textPosition} onChange={e => setTextPosition(e.target.value)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'transparent', color: 'var(--text-main)', outline: 'none' }}>
                                        <option value="top" style={{ background: 'var(--surface-1)', color: 'var(--text-main)' }}>Top</option>
                                        <option value="center" style={{ background: 'var(--surface-1)', color: 'var(--text-main)' }}>Center</option>
                                        <option value="bottom" style={{ background: 'var(--surface-1)', color: 'var(--text-main)' }}>Bottom</option>
                                    </select>
                                </div>
                            )}

                            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                                            📊 Poll Sticker
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setHasPoll(!hasPoll)}
                                            style={{ background: hasPoll ? '#ef4444' : '#808bf5', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            {hasPoll ? 'Remove' : 'Add Poll'}
                                        </button>
                                    </div>
                                    {hasPoll && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                                            <input
                                                type="text"
                                                placeholder="Ask a question..."
                                                value={pollQuestion}
                                                onChange={(e) => setPollQuestion(e.target.value)}
                                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Yes"
                                                    value={pollOption1}
                                                    onChange={(e) => setPollOption1(e.target.value)}
                                                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="No"
                                                    value={pollOption2}
                                                    onChange={(e) => setPollOption2(e.target.value)}
                                                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px' }}>
                                    <div className='flex gap-1 items-center'>
                                        <select
                                            value={selectedMusic ? selectedMusic.title : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const found = AUDIO_PRESETS.find(a => a.title === val);
                                                setSelectedMusic(found || null);
                                            }}
                                            disabled={!!sharedStory?.music}
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', opacity: sharedStory?.music ? 0.6 : 1 }}
                                        >
                                            <option value="">🎵 Background Music</option>
                                            {AUDIO_PRESETS.map((track) => (
                                                <option key={track.title} value={track.title}>
                                                    {track.title} (by {track.artist})
                                                </option>
                                            ))}
                                        </select>

                                        {selectedMusic && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMusic(null)}
                                                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '7px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                disabled={previews.length === 0 && !sharedPost && !sharedStory}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'var(--primary)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    opacity: (previews.length === 0 && !sharedPost && !sharedStory) ? 0.6 : 1
                                }}
                            >
                                Next
                            </button>

                            {/* Ephemeral Stream action (Go Live) inside Story popup */}
                            {!sharedPost && !sharedStory && previews.length === 0 && (
                                <div className='mt-2'>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const { api } = await import('../../store/zustand/useAuthStore');
                                                const res = await api.post('/api/live/start', { title: `${loggeduser?.fullname}'s Live Stream` });
                                                const stream = res.data;
                                                const { setLiveStream } = require('../../store/zustand/usePostStore').default.getState();
                                                setLiveStream(stream._id, true);
                                                toast.success('Live stream started successfully!');
                                                onClose();
                                            } catch (err) {
                                                console.error('Failed to start stream:', err);
                                                toast.error(err.response?.data?.error || 'Could not start live stream');
                                            }
                                        }}
                                        className="bg-gradient-to-tr from-rose-500 to-red-600 text-white font-bold cursor-pointer"
                                        style={{
                                            width: '100%', padding: '10px', border: 'none', borderRadius: '10px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            boxShadow: '0 4px 14px rgba(244,63,94,0.3)', fontSize: '14px'
                                        }}
                                    >
                                        <i className="pi pi-video" style={{ fontSize: '13px' }}></i>
                                        Go Live
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div style={{ marginBottom: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setOpenTagPanel(v => !v)}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', background: 'var(--surface-2)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <i className="pi pi-user-plus" style={{ fontSize: '12px' }}></i>
                                        {taggedUsers.length > 0 ? `${taggedUsers.length} Tagged People` : "Tag People"}
                                    </span>
                                    <i className={`pi pi-chevron-${openTagPanel ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: '10px' }}></i>
                                </button>
                                {openTagPanel && (
                                    <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <i className="pi pi-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', fontSize: '11px' }}></i>
                                            <input
                                                type="text"
                                                placeholder="Search users to tag..."
                                                value={tagSearchTerm}
                                                onChange={(e) => handleSearchTags(e.target.value)}
                                                style={{ width: '100%', padding: '6px 12px 6px 28px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', boxSizing: 'border-box', outline: 'none' }}
                                            />
                                            {isSearchingTags && <i className="pi pi-spin pi-spinner" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#808bf5' }}></i>}
                                        </div>
                                        {tagSearchResults.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', background: 'var(--surface-1)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '4px' }}>
                                                {tagSearchResults.map(user => (
                                                    <div
                                                        key={user._id}
                                                        onClick={() => addTagUser(user)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderRadius: '4px' }}
                                                        className="hover:bg-white/5"
                                                    >
                                                        <img src={user.profile_picture} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>{user.fullname}</span>
                                                            <span style={{ fontSize: '9px', color: 'var(--text-sub)' }}>@{user.username}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {taggedUsers.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                                                {taggedUsers.map(user => (
                                                    <div key={user._id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-1)', border: '1px solid rgba(128, 139, 245, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '10px' }}>
                                                        <span>@{user.username}</span>
                                                        <button onClick={() => removeTagUser(user._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '9px', display: 'flex', alignItems: 'center' }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <i className="pi pi-eye" style={{ fontSize: '12px' }}></i>
                                        Visibility
                                    </span>
                                    <select
                                        value={visibility}
                                        onChange={(e) => setVisibility(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="public" style={{ background: 'var(--surface-1)' }}>🌐 Public</option>
                                        <option value="followers" style={{ background: 'var(--surface-1)' }}>👥 Followers Only</option>
                                        <option value="close_friends" style={{ background: 'var(--surface-1)' }}>🟢 Close Friends</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        background: 'var(--surface-3)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px'
                                    }}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={uploading || (previews.length === 0 && !sharedPost && !sharedStory)}
                                    style={{
                                        flex: 2,
                                        padding: '10px',
                                        background: 'var(--primary)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        opacity: (uploading || (previews.length === 0 && !sharedPost && !sharedStory)) ? 0.6 : 1
                                    }}
                                >
                                    {uploading ? 'Uploading...' : (sharedPost || sharedStory) ? 'Share to Story' : `Share ${previews.length > 1 ? previews.length + ' Stories' : 'Story'}`}
                                </button>
                            </div>
                        </>
                    )}
                </div>
                {croppingState.visible && (
                    <ImageCropper
                        image={croppingState.imageSrc}
                        visible={croppingState.visible}
                        initialAspect={9 / 16}
                        onCropComplete={handleCropComplete}
                        onCancel={() => setCroppingState({ visible: false, imageSrc: null, pendingFiles: [] })}
                    />
                )}
            </Dialog>

            <Dialog
                visible={showDraftsListModal}
                onHide={() => setShowDraftsListModal(false)}
                header="Saved Story Drafts"
                modal
                style={{ width: '90vw', maxWidth: '500px' }}
                contentStyle={{ padding: '10px', paddingTop: '0px', background: 'var(--surface-1)' }}
                appendTo={document.body}
            >
                <div className="flex flex-col gap-3">
                    {drafts.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-[var(--surface-2)]">
                            <div className="flex flex-col gap-1 min-w-0 flex-1 mr-2">
                                <span className="font-semibold text-xs text-[var(--text-main)] truncate">
                                    {d.text || `Story draft with ${d.previews?.length || 0} media item(s)`}
                                </span>
                                <span className="text-[var(--text-sub)] text-[10px]">
                                    Last saved: {new Date(d.updatedAt).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => {
                                        restoreDraft(d);
                                        setShowDraftsListModal(false);
                                    }}
                                    className="bg-[#808bf5] text-white border-0 px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer hover:opacity-95 transition"
                                >
                                    Restore
                                </button>
                                <button
                                    onClick={() => deleteDraft(d.id)}
                                    className="bg-transparent border border-red-500/30 text-red-500 px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer hover:bg-red-500/10 transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {drafts.length === 0 && (
                        <p className="text-[var(--text-sub)] text-xs text-center">No drafts saved.</p>
                    )}
                </div>
            </Dialog>

            <Dialog
                visible={showCloseConfirm}
                onHide={() => setShowCloseConfirm(false)}
                header="Save as draft?"
                modal
                style={{ width: '90vw', maxWidth: '400px' }}
                contentStyle={{ padding: '20px', background: 'var(--surface-1)' }}
                appendTo={document.body}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-[var(--text-sub)] text-sm m-0">
                        You have unsaved changes. Would you like to save this story as a draft to continue editing later, or discard it?
                    </p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={async () => {
                                await saveDraft(true);
                                onClose();
                                setShowCloseConfirm(false);
                            }}
                            className="w-full bg-[#808bf5] text-white border-0 py-2.5 rounded-lg font-bold cursor-pointer hover:opacity-95 transition-colors text-sm"
                        >
                            Save to Draft
                        </button>
                        <button
                            onClick={async () => {
                                if (activeDraftId) {
                                    await deleteDraft(activeDraftId);
                                }
                                onClose();
                                setShowCloseConfirm(false);
                            }}
                            className="w-full bg-transparent border border-red-500/30 text-red-500 py-2.5 rounded-lg font-bold cursor-pointer hover:bg-red-500/10 transition-colors text-sm"
                        >
                            Discard Story
                        </button>
                        <button
                            onClick={() => setShowCloseConfirm(false)}
                            className="w-full bg-transparent border border-gray-300 dark:border-gray-700 text-[var(--text-main)] py-2.5 rounded-lg font-bold cursor-pointer hover:bg-[var(--surface-2)] transition-colors text-sm"
                        >
                            Keep Editing
                        </button>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

const Stories = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user: loggeduser, initialized } = useAuthStore();
    const { data: storyFeed } = useStoryFeed(loggeduser?._id);
    const { data: flags } = useSystemFlags();
    const [groups, setGroups] = useState([]);
    const viewedRef = useRef(new Set());
    const [createOpen, setCreateOpen] = useState(false);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [postVisible, setPostVisible] = useState(false);
    const [selectedPostId] = useState(null);
    const { markGroupAsViewed, sharingPostToStory, clearSharingPostToStory, viewedStoryGroups, storyDetailUserId, storyDetailStoryId, setStoryDetailDeepLink, liveStreamId, isLiveHost, clearLiveStream, setIsStoryViewerOpen, setLiveStream } = usePostStore();
    const [activeStreams, setActiveStreams] = useState([]);
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
        if (!initialized || !loggeduser?._id) return;
        const fetchActiveStreams = async () => {
            try {
                const res = await api.get('/api/live/active');
                setActiveStreams(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Failed to fetch active streams:', err);
            }
        };
        fetchActiveStreams();

        // Listen for real-time updates instead of polling
        const handleLiveStarted = (stream) => {
            // Only add if we follow the host or it's us
            const followingIds = (loggeduser.following || []).map(id => id.toString());
            const hostId = stream.host?._id?.toString() || stream.host?.toString();

            if (hostId === loggeduser._id.toString() || followingIds.includes(hostId)) {
                setActiveStreams(prev => {
                    if (prev.find(s => s._id === stream._id)) return prev;
                    return [stream, ...prev];
                });
            }
        };

        const handleLiveEnded = (streamId) => {
            setActiveStreams(prev => prev.filter(s => s._id !== streamId));
        };

        socket.on('liveStreamStarted', handleLiveStarted);
        socket.on('liveStreamEnded', handleLiveEnded);

        return () => {
            socket.off('liveStreamStarted', handleLiveStarted);
            socket.off('liveStreamEnded', handleLiveEnded);
        };
    }, [initialized, loggeduser?._id, loggeduser?.following]);

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

        // Broadcast story creation
        appChannel.postMessage({
            type: "STORY_CREATED",
            story: newStory
        });

        setGroups(prev => {
            const idx = prev.findIndex(g => g.user._id.toString() === myId);
            if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, newStory] };
                groupIndex = idx;
                return updated;
            }
            groupIndex = 0;
            return [{ user: { _id: loggeduser._id, username: loggeduser.username, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }, stories: [newStory], hasUnviewed: false }, ...prev];
        });

        if (sharingPostToStory && groupIndex !== -1) {
            const group = groups[groupIndex];
            if (group) {
                const target = group.user.username || group.user._id;
                navigate(`/stories/${target}/${newStory._id}`);
            }
            clearSharingPostToStory();
        }

        queryClient.invalidateQueries(['story-feed']);
    };

    // ── Broadcast Event Observers ──
    useBroadcast('STORY_CREATED', (incoming) => {
        const story = incoming.story;
        const storyUserId = story.user?._id?.toString() || story.user?.toString();
        setGroups(prev => {
            const idx = prev.findIndex(g => g.user._id.toString() === storyUserId);
            if (idx !== -1) {
                const updated = [...prev];
                // Avoid duplicates
                if (updated[idx].stories.some(s => s._id === story._id)) return prev;
                updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, story], hasUnviewed: true };
                return updated;
            }
            // Fetch fresh details or append if basic user object is present in story
            if (story.user) {
                return [...prev, { user: story.user, stories: [story], hasUnviewed: true }];
            }
            return prev;
        });
    });

    useBroadcast('STORY_DELETED', ({ storyId }) => {
        setGroups(prev => prev.map(g => {
            const remaining = g.stories.filter(s => s._id !== storyId);
            return { ...g, stories: remaining };
        }).filter(g => g.stories.length > 0));
    });

    const openViewer = (index) => {
        const group = groups[index];
        if (group) {
            markGroupAsViewed(group.user._id);
            const target = group.user.username || group.user._id;
            navigate(`/stories/${target}`);
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
                                onClick={() => {
                                    if (ownGroup) {
                                        openViewer(groups.findIndex(g => g.user._id.toString() === loggeduser?._id?.toString()));
                                    } else {
                                        if (flags?.story_creation === false) {
                                            toast.error('Story creation is temporarily disabled by administrator.');
                                        } else {
                                            setCreateOpen(true);
                                        }
                                    }
                                }}
                                style={{
                                    width: storySize, height: storySize, borderRadius: '50%', padding: '2px',
                                    background: ownGroup ? ((!ownGroup.hasUnviewed || viewedStoryGroups.has(loggeduser?._id?.toString())) ? 'var(--border-color)' : (ownGroup.stories.some(s => s.visibility === 'close_friends') ? 'linear-gradient(135deg, #22c55e, #10b981)' : 'linear-gradient(135deg, #808bf5, #ec4899)')) : 'var(--border-color)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--surface-1)' }}>
                                    <img
                                        src={loggeduser?.profile_picture || USER_DEFAULT_IMAGE}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                            </div>
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (flags?.story_creation === false) {
                                        toast.error('Story creation is temporarily disabled by administrator.');
                                    } else {
                                        setCreateOpen(true);
                                    }
                                }}
                                style={{ position: 'absolute', bottom: isMobile ? 0 : 4, right: isMobile ? 0 : 4, width: isMobile ? 20 : 24, height: isMobile ? 20 : 24, background: '#808bf5', borderRadius: '50%', border: '2px solid var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: isMobile ? '14px' : '16px', fontWeight: 700, zIndex: 5 }}
                            >
                                <i className="pi pi-plus" style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: 'bold' }}></i>
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 500, textAlign: 'center', maxWidth: storySize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ownGroup ? 'Your story' : 'Add story'}
                        </span>
                    </div>

                    {/* Active Followings Live Streams */}
                    {activeStreams.map(stream => {
                        const host = stream.host;
                        if (!host) return null;
                        return (
                            <div key={stream._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setLiveStream(stream._id, false)}>
                                <div style={{ position: 'relative', width: storySize, height: storySize }}>
                                    <div
                                        style={{
                                            width: storySize, height: storySize, borderRadius: '50%', padding: '2px',
                                            background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
                                            transition: 'all 0.3s ease',
                                            boxShadow: '0 0 12px rgba(239, 68, 68, 0.8)',
                                            animation: 'pulse-ring 2s infinite'
                                        }}
                                    >
                                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--surface-1)' }}>
                                            <img
                                                src={host.profile_picture || USER_DEFAULT_IMAGE}
                                                alt=""
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    </div>
                                    <div
                                        style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', fontSize: '8px', fontWeight: 800, padding: '1.5px 6px', borderRadius: '4px', border: '1.5px solid var(--surface-1)', letterSpacing: '0.5px', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                    >
                                        LIVE
                                    </div>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 700, textAlign: 'center', maxWidth: storySize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {host.fullname.split(' ')[0]}
                                </span>
                            </div>
                        );
                    })}
                    {otherGroups.map(group => {
                        const realIndex = groups.findIndex(g => g.user._id.toString() === group.user._id.toString());
                        const allViewed = !group.hasUnviewed || viewedStoryGroups.has(group.user._id.toString());
                        const hasCloseFriends = group.stories.some(s => s.visibility === 'close_friends');
                        const ringGradient = hasCloseFriends ? 'linear-gradient(135deg, #22c55e, #10b981)' : 'linear-gradient(135deg, #808bf5, #ec4899)';
                        return (
                            <div key={group.user._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
                                <div
                                    onClick={() => openViewer(realIndex)}
                                    style={{ position: 'relative', width: storySize, height: storySize, borderRadius: '50%', padding: '2px', background: allViewed ? 'var(--border-color)' : ringGradient, transition: 'all 0.3s ease', flexShrink: 0 }}
                                >
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--surface-1)' }} className={group.user.isOnline ? 'presence-glow' : ''}>
                                        <img
                                            src={group.user.profile_picture || USER_DEFAULT_IMAGE}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    {group.user.isOnline && <div className="presence-dot bottom-0 right-2" style={{ width: isMobile ? 12 : 16, height: isMobile ? 12 : 16, border: '2px solid var(--surface-1)' }} />}
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
                    @keyframes pulse-ring {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                        70% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                `}</style>
            </div>
            {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={handleStoryCreated} loggeduser={loggeduser} />}


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
