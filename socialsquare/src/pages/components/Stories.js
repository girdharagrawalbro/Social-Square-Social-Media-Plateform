import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { uploadToCloudinary, validateImageFile } from '../../utils/cloudinary';
import { socket } from '../../socket';
import toast from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const StoryViewer = ({ groups, startGroupIndex, onClose, loggeduser, onStoryDeleted }) => {
    const [groupIndex, setGroupIndex] = useState(startGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);

    const group = groups[groupIndex];
    const story = group?.stories[storyIndex];
    const DURATION = story?.media?.type === 'video' ? 15000 : 5000;

    useEffect(() => {
        if (!story) return;
        if (story._id && loggeduser?._id) {
            fetch(`${BASE}/api/story/view/${story._id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggeduser._id }),
            }).catch(() => {});
        }
        setProgress(0);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) { clearInterval(intervalRef.current); goNext(); return 0; }
                return prev + (100 / (DURATION / 100));
            });
        }, 100);
        return () => clearInterval(intervalRef.current);
    }, [groupIndex, storyIndex, story?._id]);

    const goNext = () => {
        if (!group) return;
        if (storyIndex < group.stories.length - 1) setStoryIndex(s => s + 1);
        else if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); }
        else onClose();
    };
    const goPrev = () => {
        if (storyIndex > 0) setStoryIndex(s => s - 1);
        else if (groupIndex > 0) { setGroupIndex(g => g - 1); setStoryIndex(0); }
    };

    if (!story || !group) return null;
    const isOwn = group.user._id.toString() === loggeduser?._id?.toString();

    const handleDelete = async () => {
        try {
            await fetch(`${BASE}/api/story/${story._id}`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggeduser._id }),
            });
            toast.success('Story deleted');
            // ✅ Update parent state
            onStoryDeleted(group.user._id.toString(), story._id);
            if (group.stories.length <= 1) {
                if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); }
                else onClose();
            } else { goNext(); }
        } catch { toast.error('Failed to delete'); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '100vh', maxHeight: '700px' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: '4px', zIndex: 10 }}>
                    {group.stories.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#fff', width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%', transition: 'width 0.1s linear' }} />
                        </div>
                    ))}
                </div>
                <div style={{ position: 'absolute', top: 24, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={group.user.profile_picture} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                        <div>
                            <p style={{ margin: 0, color: '#fff', fontSize: '13px', fontWeight: 600 }}>{group.user.fullname}</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                                {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && ` · ${story.viewers?.length || 0} views`}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {isOwn && <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>🗑️</button>}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '24px' }}>✕</button>
                    </div>
                </div>
                {story.media.type === 'video'
                    ? <video src={story.media.url} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={story.media.url} alt="story" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                }
                {story.text?.content && (
                    <div style={{ position: 'absolute', top: story.text.position === 'top' ? '20%' : story.text.position === 'bottom' ? '75%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: story.text.color || '#fff', fontSize: '22px', fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.8)', textAlign: 'center', padding: '8px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', maxWidth: '80%' }}>
                        {story.text.content}
                    </div>
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 5 }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={goPrev} />
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={goNext} />
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
                const fd = new FormData();
                fd.append('file', file); fd.append('upload_preset', 'socialsquare'); fd.append('resource_type', 'video');
                const res = await fetch(`https://api.cloudinary.com/v1_1/dcmrsdydr/video/upload`, { method: 'POST', body: fd });
                mediaUrl = (await res.json()).secure_url;
            } else { mediaUrl = await uploadToCloudinary(file); }

            const res = await fetch(`${BASE}/api/story/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggeduser._id, mediaUrl, mediaType, text: text ? { content: text, color: textColor, position: textPosition } : null }),
            });
            const newStory = await res.json();
            toast.success('Story created!');
            onCreated(newStory); // ✅ pass back to parent
            onClose();
        } catch { toast.error('Failed to create story'); }
        setUploading(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface-1)', borderRadius: '16px', padding: '24px', width: '360px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Create Story</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>
                <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: 'var(--surface-2)', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    {preview ? (mediaType === 'video' ? <video src={preview} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px' }} controls /> : <img src={preview} alt="" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />) : <div><p style={{ fontSize: '32px', margin: 0 }}>📷</p><p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0 0' }}>Tap to add photo or video</p></div>}
                    {preview && text && <div style={{ position: 'absolute', top: textPosition === 'top' ? '15%' : textPosition === 'bottom' ? '75%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: textColor, fontSize: '18px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>{text}</div>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <input type="text" placeholder="Add text overlay (optional)" value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px' }} />
                {text && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'].map(color => (
                            <button key={color} onClick={() => setTextColor(color)} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: textColor === color ? '3px solid #808bf5' : '2px solid var(--border-color)', cursor: 'pointer' }} />
                        ))}
                        <select value={textPosition} onChange={e => setTextPosition(e.target.value)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
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
    const { loggeduser } = useSelector(state => state.users);
    const [groups, setGroups] = useState([]);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
    const [createOpen, setCreateOpen] = useState(false);

    const fetchStories = async () => {
        if (!loggeduser?._id) return;
        try {
            const res = await fetch(`${BASE}/api/story/feed/${loggeduser._id}`);
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } catch {}
    };

    useEffect(() => { fetchStories(); }, [loggeduser?._id]);

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
        socket.on('newStory', handleNewStory);
        return () => socket.off('newStory', handleNewStory);
    }, [loggeduser?._id]);

    // ✅ Delete story from local state
    const handleStoryDeleted = (userId, storyId) => {
        setGroups(prev =>
            prev.map(g => g.user._id.toString() === userId
                ? { ...g, stories: g.stories.filter(s => s._id !== storyId) }
                : g
            ).filter(g => g.stories.length > 0)
        );
    };

    // ✅ Add created story to own group optimistically
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
                    <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 500, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ownGroup ? 'Your story' : 'Add story'}
                    </span>
                </div>
                {otherGroups.map(group => {
                    const realIndex = groups.findIndex(g => g.user._id.toString() === group.user._id.toString());
                    const allViewed = !group.hasUnviewed;
                    return (
                        <div key={group.user._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }} onClick={() => openViewer(realIndex)}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', padding: '2px', background: allViewed ? 'var(--border-color)' : 'linear-gradient(135deg, #808bf5, #ec4899)' }}>
                                <img src={group.user.profile_picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: allViewed ? 400 : 600, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {group.user.fullname.split(' ')[0]}
                            </span>
                        </div>
                    );
                })}
            </div>
            {viewerOpen && groups.length > 0 && (
                <StoryViewer groups={groups} startGroupIndex={Math.min(viewerGroupIndex, groups.length - 1)} onClose={() => setViewerOpen(false)} loggeduser={loggeduser} onStoryDeleted={handleStoryDeleted} />
            )}
            {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={handleStoryCreated} loggeduser={loggeduser} />}
        </>
    );
};

export default Stories;