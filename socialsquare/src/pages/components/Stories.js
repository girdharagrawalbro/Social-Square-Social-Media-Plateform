import React, { useState, useEffect, useRef } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useStoryFeed } from '../../hooks/queries/useAuthQueries';
import { uploadToCloudinary, uploadVideoToCloudinary, validateImageFile } from '../../utils/cloudinary';
import { socket } from '../../socket';
import toast from 'react-hot-toast';

const StoryViewer = ({ groups, startGroupIndex, onClose, loggeduser, onStoryDeleted, onStoryLiked }) => {
    const [groupIndex, setGroupIndex] = useState(startGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);

    const group = groups[groupIndex];
    const story = group?.stories[storyIndex];
    const DURATION = story?.media?.type === 'video' ? 15000 : 5000;

    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);

    const [isPaused, setIsPaused] = useState(false);

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
        else if (groupIndex < groups.length - 1) {
            setGroupIndex(g => g + 1);
            setStoryIndex(0);
        } else onClose();
    }, [group, storyIndex, groupIndex, groups.length, onClose]);

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

    }, [story?._id, DURATION, loggeduser?._id, goNext, isPaused]);

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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.38)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        <img src={group.user.profile_picture || '/default-profile.png'} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.8)' }} />
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

                {/* Media */}
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {story.media.type === 'video'
                        ? <video src={story.media.url} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src={story.media.url} alt="story" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    }
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
                    <div style={{ flex: 1, height: 44, borderRadius: '22px', border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', padding: '0 15px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Send message...</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <button onClick={handleLike} style={{ background: 'none', border: 'none', color: isLiked ? '#ff4b4b' : '#fff', cursor: 'pointer', height: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: isLiked ? 'scale(1.1)' : 'scale(1)' }}>
                            <i className={`pi ${isLiked ? 'pi-heart-fill' : 'pi-heart'}`} style={{ fontSize: '24px' }}></i>
                        </button>
                        {/* {likesCount > 0 && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{likesCount}</span>} */}
                    </div>

                    <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', height: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="pi pi-send" style={{ fontSize: '20px' }}></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateStoryModal = ({ onClose, onCreated, loggeduser }) => {
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);
    const [mediaType, setMediaType] = useState('image');
    const [text, setText] = useState('');
    const [textColor, setTextColor] = useState('#ffffff');
    const [textPosition, setTextPosition] = useState('center');
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const isVideo = f.type.startsWith('video/');
        if (!isVideo) { const err = validateImageFile(f); if (err) { toast.error(err); return; } }
        setFile(f); setMediaType(isVideo ? 'video' : 'image'); setPreview(URL.createObjectURL(f));
    };

    const handleSubmit = async () => {
        if (!file) { toast.error('Please select an image or video'); return; }
        setUploading(true);
        try {
            let mediaUrl;
            if (mediaType === 'video') {
                mediaUrl = await uploadVideoToCloudinary(file);
            } else { mediaUrl = await uploadToCloudinary(file); }

            const { api } = await import('../../store/zustand/useAuthStore');
            const res = await api.post(`/api/story/create`, {
                mediaUrl, mediaType,
                text: text ? { content: text, color: textColor, position: textPosition } : null
            });
            const newStory = res.data;
            toast.success('Story created!');
            onCreated(newStory);
            onClose();
        } catch { toast.error('Failed to create story'); }
        setUploading(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.25)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '360px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Create Story</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>
                <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: '#f9fafb', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    {preview ? (mediaType === 'video' ? <video src={preview} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px' }} controls /> : <img src={preview} alt="" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />) : <div><p style={{ fontSize: '32px', margin: 0 }}>📷</p><p style={{ color: '#9ca3af', fontSize: '13px', margin: '8px 0 0' }}>Tap to add photo or video</p></div>}
                    {preview && text && <div style={{ position: 'absolute', top: textPosition === 'top' ? '15%' : textPosition === 'bottom' ? '75%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: textColor, fontSize: '18px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>{text}</div>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <input type="text" placeholder="Add text overlay (optional)" value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px' }} />
                {text && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'].map(color => (
                            <button key={color} onClick={() => setTextColor(color)} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: textColor === color ? '3px solid #808bf5' : '2px solid #e5e7eb', cursor: 'pointer' }} />
                        ))}
                        <select value={textPosition} onChange={e => setTextPosition(e.target.value)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}>
                            <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
                        </select>
                    </div>
                )}
                <button onClick={handleSubmit} disabled={uploading || !file} style={{ width: '100%', padding: '10px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', opacity: !file ? 0.6 : 1 }}>
                    {uploading ? 'Uploading...' : 'Share Story'}
                </button>
            </div>
        </div>
    );
};

const Stories = () => {
    const loggeduser = useAuthStore(s => s.user);
    const [groups, setGroups] = useState([]);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
    const [createOpen, setCreateOpen] = useState(false);

    // ✅ TanStack Query - cached, deduplicated requests
    const { data: storyFeed = [] } = useStoryFeed(loggeduser?._id);

    // Sync TanStack Query data with local state
    useEffect(() => {
        setGroups(storyFeed);
    }, [storyFeed]);

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
        setGroups(prev => {
            const idx = prev.findIndex(g => g.user._id.toString() === myId);
            if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, newStory] };
                return updated;
            }
            return [{ user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }, stories: [newStory], hasUnviewed: false }, ...prev];
        });
    };

    const openViewer = (index) => { setViewerGroupIndex(index); setViewerOpen(true); };
    const ownGroup = groups.find(g => g.user._id.toString() === loggeduser?._id?.toString());
    const otherGroups = groups.filter(g => g.user._id.toString() !== loggeduser?._id?.toString());

    return (
        <>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 4px', scrollbarWidth: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => ownGroup ? openViewer(groups.findIndex(g => g.user._id.toString() === loggeduser?._id?.toString())) : setCreateOpen(true)}>
                    <div style={{ position: 'relative', width: 60, height: 60 }}>
                        <img src={loggeduser?.profile_picture} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: ownGroup ? '3px solid #808bf5' : '3px solid #e5e7eb' }} />
                        {!ownGroup && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: '#808bf5', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 700 }}>+</div>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#374151', fontWeight: 500, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ownGroup ? 'Your story' : 'Add story'}
                    </span>
                </div>
                {otherGroups.map(group => {
                    const realIndex = groups.findIndex(g => g.user._id.toString() === group.user._id.toString());
                    const allViewed = !group.hasUnviewed;
                    return (
                        <div key={group.user._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }} onClick={() => openViewer(realIndex)}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', padding: '2px', background: allViewed ? '#e5e7eb' : 'linear-gradient(135deg, #808bf5, #ec4899)' }}>
                                <img src={group.user.profile_picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: '#374151', fontWeight: allViewed ? 400 : 600, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {group.user.fullname.split(' ')[0]}
                            </span>
                        </div>
                    );
                })}
            </div>
            {viewerOpen && groups.length > 0 && (
                <StoryViewer groups={groups} startGroupIndex={Math.min(viewerGroupIndex, groups.length - 1)} onClose={() => setViewerOpen(false)} loggeduser={loggeduser} onStoryDeleted={handleStoryDeleted} onStoryLiked={handleStoryLiked} />
            )}
            {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={handleStoryCreated} loggeduser={loggeduser} />}
        </>
    );
};

export default Stories;