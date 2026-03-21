import React, { useState, useRef, useEffect } from "react";
import useAuthStore from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import { useCreatePost } from '../../hooks/queries/usePostQueries';
import toast, { Toaster } from "react-hot-toast";

import { uploadToCloudinary, validateImageFile } from '../../utils/cloudinary';
import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😅','🥳','❤️','🔥','✨','🎉','👍','🙌','💯','🌟','😭','🤣','😊','🥹','💪','🎵','📍','🌍','🍕','☕','🌸','🌈','👀','💬'];

const EmojiPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'flex', flexWrap: 'wrap', gap: '4px', width: '220px', zIndex: 100 }}>
            {EMOJIS.map(e => <button key={e} type="button" onClick={() => onSelect(e)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}>{e}</button>)}
        </div>
    );
};

const NewPost = () => {
    const loggeduser = useAuthStore(s => s.user);
    const addSocketPost = usePostStore(s => s.addSocketPost);
    const createPostMutation = useCreatePost();
    const fileInputRef = useRef(null);
    const captionRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const [formData, setFormData] = useState({ caption: "", category: "Default" });
    const [images, setImages] = useState([]);
    const [isPosting, setIsPosting] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showExtras, setShowExtras] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Location & music
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [music, setMusic] = useState({ title: '', artist: '' });
    const [showMusicInput, setShowMusicInput] = useState(false);

    // New features
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [expiresIn, setExpiresIn] = useState(''); // hours
    const [unlocksAt, setUnlocksAt] = useState(''); // datetime string
    const [isCollaborative, setIsCollaborative] = useState(false);
    const [collaboratorSearch, setCollaboratorSearch] = useState('');
    const [collaborators, setCollaborators] = useState([]); // [{_id, fullname, profile_picture}]

    // Voice note
    const [isRecording, setIsRecording] = useState(false);
    const [voiceBlob, setVoiceBlob] = useState(null);
    const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef(null);

    // AI
    const [generatingCaption, setGeneratingCaption] = useState(false);
    const [suggestedCaptions, setSuggestedCaptions] = useState([]);

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleEmojiSelect = (emoji) => {
        const input = captionRef.current;
        if (!input) return;
        const s = input.selectionStart, en = input.selectionEnd;
        const newCaption = formData.caption.slice(0, s) + emoji + formData.caption.slice(en);
        setFormData(prev => ({ ...prev, caption: newCaption }));
        setTimeout(() => { input.focus(); input.setSelectionRange(s + emoji.length, s + emoji.length); }, 0);
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(async pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                const data = await res.json();
                const name = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
                setLocation({ name, lat, lng });
                toast.success(`📍 ${name}`);
            } catch { setLocation({ name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng }); }
            setLoadingLocation(false);
        }, () => { toast.error('Could not get location'); setLoadingLocation(false); });
    };

    // ── Voice Recording ───────────────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = e => audioChunksRef.current.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setVoiceBlob(blob);
                setVoicePreviewUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
        } catch { toast.error('Microphone access denied'); }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
    };

    // ── AI Caption Generation ─────────────────────────────────────────────────
    const generateCaption = async () => {
        if (images.length === 0) { toast.error('Add an image first to generate a caption'); return; }
        const firstImage = images[0];
        if (!firstImage.preview) return;
        setGeneratingCaption(true);
        setSuggestedCaptions([]);
        try {
            // Upload first if not already uploaded
            let imageUrl = firstImage.url;
            if (!imageUrl) {
                imageUrl = await uploadToCloudinary(firstImage.file);
            }
            const res = await axios.post(`${BASE}/api/ai/caption`, { imageUrl });
            setSuggestedCaptions(res.data.captions || []);
        } catch { toast.error('Failed to generate caption. Check your Gemini API key.'); }
        setGeneratingCaption(false);
    };

    // ── Collaborator Search ───────────────────────────────────────────────────
    const searchCollaborator = async (query) => {
        if (!query.trim()) return;
        try {
            const res = await axios.post(`${BASE}/api/auth/search`, { query });
            return res.data.users?.filter(u => u._id !== loggeduser._id) || [];
        } catch { return []; }
    };

    const [collabResults, setCollabResults] = useState([]);
    useEffect(() => {
        if (collaboratorSearch.length < 2) { setCollabResults([]); return; }
        const timer = setTimeout(async () => {
            const results = await searchCollaborator(collaboratorSearch);
            setCollabResults(results.slice(0, 5));
        }, 400);
        return () => clearTimeout(timer);
    }, [collaboratorSearch]);

    const addCollaborator = (user) => {
        if (collaborators.find(c => c._id === user._id)) return;
        setCollaborators(prev => [...prev, user]);
        setCollaboratorSearch('');
        setCollabResults([]);
    };

    // ── File Select ───────────────────────────────────────────────────────────
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (images.length + files.length > 5) { toast.error('Max 5 images'); return; }
        const newImages = [];
        for (const file of files) {
            const err = validateImageFile(file);
            if (err) { toast.error(err); continue; }
            newImages.push({ file, preview: URL.createObjectURL(file), url: null, progress: 0, uploaded: false, id: Math.random().toString(36).slice(2) });
        }
        setImages(prev => [...prev, ...newImages]);
        e.target.value = '';
    };

    const removeImage = (id) => {
        setImages(prev => { const img = prev.find(i => i.id === id); if (img?.preview) URL.revokeObjectURL(img.preview); return prev.filter(i => i.id !== id); });
    };

    const uploadAllImages = async () => {
        const pending = images.filter(img => !img.uploaded);
        const uploaded = [...images];
        await Promise.all(pending.map(async (img) => {
            const idx = uploaded.findIndex(i => i.id === img.id);
            try {
                const url = await uploadToCloudinary(img.file, (p) => setImages(prev => prev.map(i => i.id === img.id ? { ...i, progress: p } : i)));
                uploaded[idx] = { ...uploaded[idx], url, uploaded: true, progress: 100 };
            } catch { toast.error(`Failed: ${img.file.name}`); }
        }));
        setImages(uploaded);
        return uploaded.filter(i => i.uploaded).map(i => i.url);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.caption.trim()) { toast.error("Caption cannot be empty!"); return; }
        setIsPosting(true);
        try {
            let imageURLs = [];
            if (images.length > 0) {
                imageURLs = await uploadAllImages();
                if (imageURLs.length === 0 && images.length > 0) { toast.error('Image upload failed'); setIsPosting(false); return; }
            }

            // Upload voice note if recorded
            let voiceNoteUrl = null, voiceNoteDuration = null;
            if (voiceBlob) {
                const fd = new FormData();
                fd.append('file', voiceBlob, 'voice.webm');
                fd.append('upload_preset', 'socialsquare');
                fd.append('resource_type', 'video'); // audio uses video resource type in Cloudinary
                const res = await fetch(`https://api.cloudinary.com/v1_1/dcmrsdydr/video/upload`, { method: 'POST', body: fd });
                const data = await res.json();
                voiceNoteUrl = data.secure_url;
                voiceNoteDuration = recordingDuration;
            }

            // Detect mood from caption
            let mood = null;
            try {
                const moodRes = await axios.post(`${BASE}/api/ai/detect-mood`, { caption: formData.caption });
                mood = moodRes.data.mood;
            } catch { }

            const postData = {
                ...formData, loggeduser: loggeduser?._id, imageURLs,
                location: location.name ? location : null,
                music: music.title ? music : null,
                isAnonymous,
                expiresAt: expiresIn ? new Date(Date.now() + parseInt(expiresIn) * 3600000).toISOString() : null,
                unlocksAt: unlocksAt || null,
                isCollaborative,
                collaboratorIds: collaborators.map(c => c._id),
                voiceNoteUrl, voiceNoteDuration,
                mood,
            };

            const response = await createPostMutation.mutateAsync(postData);
            const data = response.data;
            if (data?._id) {
                toast.success("Post created successfully");
                addSocketPost(data);
                images.forEach(img => URL.revokeObjectURL(img.preview));
                if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
                setImages([]); setVoiceBlob(null); setVoicePreviewUrl(null); setRecordingDuration(0);
                setFormData({ caption: "", category: "Default" });
                setLocation({ name: '', lat: null, lng: null }); setMusic({ title: '', artist: '' });
                setIsAnonymous(false); setExpiresIn(''); setUnlocksAt('');
                setIsCollaborative(false); setCollaborators([]);
                setSuggestedCaptions([]); setShowExtras(false); setShowAdvanced(false);
            } else { toast.error(data.error || "Failed to create post"); }
        } catch (error) { toast.error(error.message || "An unexpected error occurred"); }
        finally { setIsPosting(false); }
    };

    const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    return (
        <>
            <div className="new mt-2 shadow-md p-2 rounded w-100 bg-white">
                <div className="d-flex gap-2 align-items-center">
                    <img src={isAnonymous ? 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff' : (loggeduser?.profile_picture || "default-profile.png")} alt="Profile" className="logo" style={{ borderRadius: '50%' }} />
                    <form onSubmit={handleSubmit} className="flex gap-3 w-100">
                        <div className="flex flex-col w-100 gap-2">
                            <div className="flex w-100">
                                <input ref={captionRef} type="text" placeholder={isAnonymous ? "# Share your anonymous confession..." : "# Tell your thoughts to your friends"}
                                    className="py-2 px-4 bg-gray-100 rounded-full w-100" name="caption" value={formData.caption} onChange={handleChange} />

                                {/* Emoji */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer" style={{ position: 'relative' }} onClick={() => setShowEmoji(v => !v)}>
                                    <span style={{ fontSize: '18px' }}>😊</span>
                                    {showEmoji && <EmojiPicker onSelect={e => { handleEmojiSelect(e); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} />}
                                </span>

                                {/* Image */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none">
                                        <path d="M10 13.229C10.1416 13.4609 10.3097 13.6804 10.5042 13.8828C11.7117 15.1395 13.5522 15.336 14.9576 14.4722C15.218 14.3121 15.4634 14.1157 15.6872 13.8828L18.9266 10.5114C20.3578 9.02184 20.3578 6.60676 18.9266 5.11718C17.4953 3.6276 15.1748 3.62761 13.7435 5.11718L13.03 5.85978" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                        <path d="M10.9703 18.14L10.2565 18.8828C8.82526 20.3724 6.50471 20.3724 5.07345 18.8828C3.64218 17.3932 3.64218 14.9782 5.07345 13.4886L8.31287 10.1172C9.74413 8.62761 12.0647 8.6276 13.4959 10.1172C13.6904 10.3195 13.8584 10.539 14 10.7708" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

                                {/* Extras toggle */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer" onClick={() => setShowExtras(v => !v)} style={{ background: showExtras ? '#f3f4f6' : '' }}>＋</span>

                                {/* Advanced toggle */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer" onClick={() => setShowAdvanced(v => !v)} title="Advanced options"
                                    style={{ background: showAdvanced ? '#ede9fe' : '', fontSize: '14px' }}>⚙️</span>

                                {/* Submit */}
                                <button type="submit" className="border rounded-full bg-[#808bf5] flex items-center justify-center mx-1 p-2" disabled={isPosting}>
                                    {isPosting ? <span className="spinner-border spinner-border-sm text-white" role="status" /> : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#fff" fill="none">
                                            <path d="M11.922 4.79004C16.6963 3.16245 19.0834 2.34866 20.3674 3.63261C21.6513 4.91656 20.8375 7.30371 19.21 12.078L18.1016 15.3292C16.8517 18.9958 16.2267 20.8291 15.1964 20.9808C14.9195 21.0216 14.6328 20.9971 14.3587 20.9091C13.3395 20.5819 12.8007 18.6489 11.7231 14.783C11.4841 13.9255 11.3646 13.4967 11.0924 13.1692C11.0134 13.0742 10.9258 12.9866 10.8308 12.9076C10.5033 12.6354 10.0745 12.5159 9.21705 12.2769C5.35111 11.1993 3.41814 10.6605 3.0909 9.64127C3.00292 9.36724 2.97837 9.08053 3.01916 8.80355C3.17088 7.77332 5.00419 7.14834 8.6708 5.89838L11.922 4.79004Z" stroke="currentColor" strokeWidth="1.5" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* Extras panel - location + music */}
                            {showExtras && (
                                <div style={{ paddingLeft: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button type="button" onClick={handleGetLocation} disabled={loadingLocation}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: location.name ? '#ede9fe' : '#f3f4f6', border: 'none', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', color: location.name ? '#6366f1' : '#6b7280' }}>
                                            📍 {loadingLocation ? 'Getting...' : location.name || 'Add location'}
                                        </button>
                                        {location.name && <button type="button" onClick={() => setLocation({ name: '', lat: null, lng: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' }}>✕</button>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button type="button" onClick={() => setShowMusicInput(v => !v)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: music.title ? '#fdf2f8' : '#f3f4f6', border: 'none', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', color: music.title ? '#ec4899' : '#6b7280' }}>
                                            🎵 {music.title ? `${music.title}${music.artist ? ` — ${music.artist}` : ''}` : 'Add music'}
                                        </button>
                                        {music.title && <button type="button" onClick={() => setMusic({ title: '', artist: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' }}>✕</button>}
                                    </div>
                                    {showMusicInput && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            <input type="text" placeholder="Song title" value={music.title} onChange={e => setMusic(p => ({ ...p, title: e.target.value }))} style={{ flex: 1, minWidth: '120px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
                                            <input type="text" placeholder="Artist" value={music.artist} onChange={e => setMusic(p => ({ ...p, artist: e.target.value }))} style={{ flex: 1, minWidth: '100px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
                                            <button type="button" onClick={() => setShowMusicInput(false)} style={{ padding: '5px 10px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Done</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Advanced panel */}
                            {showAdvanced && (
                                <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                    {/* Anonymous */}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
                                        <span>🎭 Post anonymously</span>
                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Your name will be hidden</span>
                                    </label>

                                    {/* Expiry */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '13px' }}>⏳ Auto-delete after</span>
                                        <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)}
                                            style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}>
                                            <option value="">Never</option>
                                            <option value="1">1 hour</option>
                                            <option value="6">6 hours</option>
                                            <option value="24">24 hours</option>
                                            <option value="72">3 days</option>
                                            <option value="168">1 week</option>
                                        </select>
                                    </div>

                                    {/* Time-lock */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '13px' }}>🔒 Unlock at</span>
                                        <input type="datetime-local" value={unlocksAt} onChange={e => setUnlocksAt(e.target.value)}
                                            min={new Date().toISOString().slice(0, 16)}
                                            style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                                        {unlocksAt && <button type="button" onClick={() => setUnlocksAt('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' }}>✕</button>}
                                    </div>

                                    {/* Collaborative */}
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '6px' }}>
                                            <input type="checkbox" checked={isCollaborative} onChange={e => setIsCollaborative(e.target.checked)} />
                                            <span>🤝 Collaborative post</span>
                                        </label>
                                        {isCollaborative && (
                                            <div style={{ position: 'relative' }}>
                                                <input type="text" placeholder="Search collaborators..." value={collaboratorSearch} onChange={e => setCollaboratorSearch(e.target.value)}
                                                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxSizing: 'border-box' }} />
                                                {collabResults.length > 0 && (
                                                    <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                        {collabResults.map(u => (
                                                            <button key={u._id} type="button" onClick={() => addCollaborator(u)}
                                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                                                <img src={u.profile_picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                                                                <span style={{ fontSize: '12px' }}>{u.fullname}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {collaborators.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                        {collaborators.map(c => (
                                                            <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ede9fe', borderRadius: '20px', padding: '3px 8px', fontSize: '11px' }}>
                                                                <img src={c.profile_picture} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                                                                {c.fullname}
                                                                <button type="button" onClick={() => setCollaborators(prev => prev.filter(x => x._id !== c._id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '10px', padding: 0 }}>✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Voice note */}
                                    <div>
                                        <p style={{ fontSize: '13px', margin: '0 0 6px' }}>🎤 Voice note</p>
                                        {!voicePreviewUrl ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button type="button" onClick={isRecording ? stopRecording : startRecording}
                                                    style={{ padding: '6px 14px', background: isRecording ? '#ef4444' : '#808bf5', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {isRecording ? <>⏹ Stop {formatDuration(recordingDuration)}</> : '⏺ Record'}
                                                </button>
                                                {isRecording && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <audio src={voicePreviewUrl} controls style={{ height: '32px', flex: 1 }} />
                                                <button type="button" onClick={() => { setVoiceBlob(null); setVoicePreviewUrl(null); setRecordingDuration(0); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px' }}>Remove</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* AI Caption suggestions */}
                            {images.length > 0 && (
                                <div>
                                    <button type="button" onClick={generateCaption} disabled={generatingCaption}
                                        style={{ fontSize: '12px', color: '#808bf5', background: '#ede9fe', border: 'none', borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {generatingCaption ? '✨ Generating...' : '✨ AI: Generate caption'}
                                    </button>
                                    {suggestedCaptions.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                            {suggestedCaptions.map((cap, i) => (
                                                <button key={i} type="button" onClick={() => setFormData(p => ({ ...p, caption: cap }))}
                                                    style={{ textAlign: 'left', padding: '6px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#374151' }}>
                                                    {cap}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Image previews */}
                {images.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingLeft: '44px' }}>
                        {images.map(img => (
                            <div key={img.id} style={{ position: 'relative', width: '80px', height: '80px' }}>
                                <img src={img.preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', opacity: img.uploaded ? 1 : 0.7 }} />
                                {isPosting && !img.uploaded && (
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: '#e5e7eb', borderRadius: '0 0 8px 8px' }}>
                                        <div style={{ width: `${img.progress}%`, height: '100%', background: '#808bf5', transition: 'width 0.2s' }} />
                                    </div>
                                )}
                                {img.uploaded && <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#22c55e', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span></div>}
                                {!isPosting && <button onClick={() => removeImage(img.id)} style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>}
                            </div>
                        ))}
                        {images.length < 5 && !isPosting && (
                            <div onClick={() => fileInputRef.current?.click()} style={{ width: '80px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', fontSize: '24px' }}>+</div>
                        )}
                    </div>
                )}

                {/* Feature badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', paddingLeft: '44px' }}>
                    {isAnonymous && <span style={{ fontSize: '11px', background: '#ede9fe', color: '#6366f1', borderRadius: '12px', padding: '2px 8px' }}>🎭 Anonymous</span>}
                    {expiresIn && <span style={{ fontSize: '11px', background: '#fef3c7', color: '#d97706', borderRadius: '12px', padding: '2px 8px' }}>⏳ Expires in {expiresIn}h</span>}
                    {unlocksAt && <span style={{ fontSize: '11px', background: '#fee2e2', color: '#ef4444', borderRadius: '12px', padding: '2px 8px' }}>🔒 Time-locked</span>}
                    {isCollaborative && <span style={{ fontSize: '11px', background: '#d1fae5', color: '#059669', borderRadius: '12px', padding: '2px 8px' }}>🤝 Collaborative</span>}
                    {voicePreviewUrl && <span style={{ fontSize: '11px', background: '#dbeafe', color: '#2563eb', borderRadius: '12px', padding: '2px 8px' }}>🎤 Voice note</span>}
                </div>
            </div>
            <Toaster />
        </>
    );
};

export default NewPost;