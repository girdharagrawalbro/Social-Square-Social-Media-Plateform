import React, { useState, useRef, useEffect, useCallback } from "react";
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import { useCreatePost } from '../../hooks/queries/usePostQueries';
import { useGroups } from '../../hooks/queries/useAuthQueries';
import toast, { Toaster } from "react-hot-toast";

import { uploadToCloudinary, uploadVideoToCloudinary, validateImageFile, validateVideoFile } from '../../utils/cloudinary';
import axios from "axios";
import ImageCropper from "./ui/ImageCropper";

const BASE = process.env.REACT_APP_BACKEND_URL;
const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😅', '🥳', '❤️', '🔥', '✨', '🎉', '👍', '🙌', '💯', '🌟', '😭', '🤣', '😊', '🥹', '💪', '🎵', '📍', '🌍', '🍕', '☕', '🌸', '🌈', '👀', '💬'];

const defaultAiLimit = {
    text: { count: 0, limit: 2, remaining: 2 },
    image: { count: 0, limit: 2, remaining: 2 },
    remaining: 2,
};

const normalizeAiLimit = (data = {}) => ({
    text: {
        count: data?.text?.count ?? 0,
        limit: data?.text?.limit ?? 2,
        remaining: data?.text?.remaining ?? 2,
    },
    image: {
        count: data?.image?.count ?? 0,
        limit: data?.image?.limit ?? 2,
        remaining: data?.image?.remaining ?? 2,
    },
    remaining: data?.remaining ?? Math.min(data?.text?.remaining ?? 2, data?.image?.remaining ?? 2),
});

const EmojiPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} className="flex flex-wrap gap-2 p-2 mt-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl shadow-lg" >
            {EMOJIS.map(e => <button key={e} type="button" className="border border-[var(--border-color)] rounded-full bg-[var(--surface-2)] text-[var(--text-main)] text-xl cursor-pointer p-1.5 hover:scale-110 transition-transform" onClick={() => onSelect(e)}>{e}</button>)}
        </div>
    );
};

const NewPost = ({ setnewpostVisible }) => {
    const loggeduser = useAuthStore(s => s.user);
    const addSocketPost = usePostStore(s => s.addSocketPost);
    const createPostMutation = useCreatePost();
    const fileInputRef = useRef(null);
    const captionRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const [formData, setFormData] = useState({ caption: "", category: "Default" });
    const [images, setImages] = useState([]);
    const [video, setVideo] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    // Central panel state: null | 'emoji' | 'ai' | 'advanced' | 'poll' | 'music'
    const [openFeaturePanel, setOpenFeaturePanel] = useState(null);

    // Location & music
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [music, setMusic] = useState({ title: '', artist: '' });

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
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiLimit, setAiLimit] = useState(defaultAiLimit);
    const [usedAiForThisPost, setUsedAiForThisPost] = useState(false);

    // Polls & Quizzes
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [isQuiz, setIsQuiz] = useState(false);
    const [correctOptionIndex, setCorrectOptionIndex] = useState(null);

    // Groups
    const { data: allGroups } = useGroups();
    const myGroups = allGroups?.filter(g => g.members.some(m => (m._id || m) === loggeduser?._id)) || [];
    const [selectedGroupId, setSelectedGroupId] = useState(null);

    // Cropping
    const [croppingState, setCroppingState] = useState({
        visible: false,
        imageSrc: null,
        pendingFiles: []
    });

    useEffect(() => {
        if (loggeduser?._id) {
            api.get(`/api/ai/limit`)
                .then(res => setAiLimit(normalizeAiLimit(res.data)))
                .catch(() => { });
        }
    }, [loggeduser?._id]);


    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // Central panel toggle: closes all others when opening a new one
    const togglePanel = (panelName) => {
        setOpenFeaturePanel(openFeaturePanel === panelName ? null : panelName);
    };

    // Close panel when pressing Escape
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') setOpenFeaturePanel(null);
        };
        document.addEventListener('keydown', handleEscapeKey);
        return () => document.removeEventListener('keydown', handleEscapeKey);
    }, []);

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
            let imageUrl = firstImage.url;
            if (!imageUrl) {
                imageUrl = await uploadToCloudinary(firstImage.file);
            }
            const res = await api.post(`/api/ai/caption`, { imageUrl });
            setSuggestedCaptions(res.data.captions || []);
        } catch { toast.error('Failed to generate caption. Check your Gemini API key.'); }
        setGeneratingCaption(false);
    };

    const generateAiText = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/generate-text`, { prompt: aiPrompt });
            setFormData(p => ({ ...p, caption: res.data.text }));
            setAiLimit(prev => normalizeAiLimit({
                ...prev,
                text: {
                    ...prev.text,
                    remaining: res.data.textRemaining ?? res.data.remaining ?? prev.text.remaining,
                },
            }));
            setUsedAiForThisPost(true);
            toast.success(`✨ Text generated using ${res.data.model}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate text');
        } finally { setIsGeneratingAi(false); }
    };

    const generateAiImage = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }
        if (images.length >= 5) { toast.error('Max 5 images reached'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/generate-image`, { prompt: aiPrompt });
            const newImg = {
                id: Math.random().toString(36).slice(2),
                preview: res.data.imageUrl,
                url: res.data.imageUrl,
                uploaded: true,
                progress: 100
            };
            setImages(prev => [...prev, newImg]);
            setAiLimit(prev => normalizeAiLimit({
                ...prev,
                image: {
                    ...prev.image,
                    remaining: res.data.imageRemaining ?? res.data.remaining ?? prev.image.remaining,
                },
            }));
            setUsedAiForThisPost(true);
            toast.success(`✨ Image generated using ${res.data.model}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate image');
        } finally { setIsGeneratingAi(false); }
    };

    const generateAiMeta = async () => {
        const source = formData.caption?.trim() || aiPrompt?.trim();
        if (!source) { toast.error('Write a caption or prompt first'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/suggest-meta`, {
                caption: formData.caption,
                prompt: aiPrompt,
            });

            const improvedCaption = res.data?.improvedCaption || source;
            const hashtags = Array.isArray(res.data?.hashtags) ? res.data.hashtags : [];
            const mergedCaption = hashtags.length
                ? `${improvedCaption}\n\n${hashtags.join(' ')}`
                : improvedCaption;

            setFormData(prev => ({
                ...prev,
                caption: mergedCaption,
                category: res.data?.category || prev.category || 'Default',
            }));
            toast.success('✨ Hashtags and category suggested');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to suggest metadata');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const generateAndPostAi = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/generate-and-post`, {
                prompt: aiPrompt,
                category: formData.category || 'Default',
                makeAnonymous: isAnonymous,
            });

            const createdPost = res.data?.post;
            if (!createdPost?._id) {
                toast.error('Failed to create AI post');
                return;
            }

            addSocketPost(createdPost);
            const aiData = res.data?.ai;
            setAiLimit(prev => normalizeAiLimit({
                ...prev,
                text: {
                    ...prev.text,
                    remaining: aiData?.textRemaining ?? prev.text.remaining,
                },
                image: {
                    ...prev.image,
                    remaining: aiData?.imageRemaining ?? prev.image.remaining,
                },
            }));

            // Show detailed success message with AI models and remaining usage
            const successMsg = `✨ Post created!`;
            toast.success(successMsg, { duration: 4000 });

            if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
            images.forEach(img => img.preview && URL.revokeObjectURL(img.preview));
            setImages([]);
            setVoiceBlob(null);
            setVoicePreviewUrl(null);
            setRecordingDuration(0);
            setFormData({ caption: '', category: 'Default' });
            setAiPrompt('');
            setLocation({ name: '', lat: null, lng: null });
            setMusic({ title: '', artist: '' });
            setIsAnonymous(false);
            setExpiresIn('');
            setUnlocksAt('');
            setIsCollaborative(false);
            setCollaborators([]);
            setSuggestedCaptions([]);
            setOpenFeaturePanel(null);
            setnewpostVisible(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate and post');
        } finally {
            setIsGeneratingAi(false);
        }
    };



    // ── Collaborator Search ───────────────────────────────────────────────────
    const searchCollaborator = useCallback(async (query) => {
        if (!query.trim()) return [];
        try {
            const res = await axios.post(`${BASE}/api/auth/search`, { query });
            return res.data.users?.filter(u => u._id !== loggeduser._id) || [];
        } catch { return []; }
    }, [loggeduser?._id]);

    const [collabResults, setCollabResults] = useState([]);
    useEffect(() => {
        if (collaboratorSearch.length < 2) { setCollabResults([]); return; }
        const timer = setTimeout(async () => {
            const results = await searchCollaborator(collaboratorSearch);
            setCollabResults(results.slice(0, 5));
        }, 400);
        return () => clearTimeout(timer);
    }, [collaboratorSearch, searchCollaborator]);

    const addCollaborator = (user) => {
        if (collaborators.find(c => c._id === user._id)) return;
        setCollaborators(prev => [...prev, user]);
        setCollaboratorSearch('');
        setCollabResults([]);
    };

    // ── File Select & Crop ───────────────────────────────────────────────────
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);

        // If any video file present, handle video upload flow (single video per post)
        const videoFile = files.find(f => f.type && f.type.startsWith('video/'));
        if (videoFile) {
            // validate video file (size & type)
            const vErr = validateVideoFile(videoFile);
            if (vErr) { toast.error(vErr); e.target.value = ''; return; }

            // check duration
            const duration = await new Promise((resolve) => {
                const url = URL.createObjectURL(videoFile);
                const vid = document.createElement('video');
                vid.preload = 'metadata';
                vid.src = url;
                vid.onloadedmetadata = () => {
                    URL.revokeObjectURL(url);
                    resolve(vid.duration || 0);
                };
                vid.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
            });

            if (duration === 0) { toast.error('Unable to read video metadata'); e.target.value = ''; return; }
            if (duration > 30) { toast.error('Video must be 30 seconds or shorter'); e.target.value = ''; return; }

            // Accept single video - clear images
            images.forEach(img => img.preview && URL.revokeObjectURL(img.preview));
            setImages([]);
            setVideo({ file: videoFile, preview: URL.createObjectURL(videoFile), duration, uploaded: false, url: null, progress: 0, id: Math.random().toString(36).slice(2) });
            e.target.value = '';
            return;
        }

        // Image flow
        if (images.length + files.length > 5) { toast.error('Max 5 images'); e.target.value = ''; return; }
        const validFiles = files.filter(f => !validateImageFile(f));
        if (validFiles.length === 0) { e.target.value = ''; return; }

        // Start cropping the first file
        const first = validFiles[0];
        const reader = new FileReader();
        reader.onload = () => {
            setCroppingState({
                visible: true,
                imageSrc: reader.result,
                pendingFiles: validFiles.slice(1)
            });
        };
        reader.readAsDataURL(first);
        e.target.value = '';
    };

    const handleCropComplete = (croppedFile) => {
        const newImg = {
            file: croppedFile,
            preview: URL.createObjectURL(croppedFile),
            url: null,
            progress: 0,
            uploaded: false,
            id: Math.random().toString(36).slice(2)
        };
        setImages(prev => [...prev, newImg]);

        // Process next file if any
        if (croppingState.pendingFiles.length > 0) {
            const next = croppingState.pendingFiles[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCroppingState({
                    visible: true,
                    imageSrc: reader.result,
                    pendingFiles: croppingState.pendingFiles.slice(1)
                });
            };
            reader.readAsDataURL(next);
        } else {
            setCroppingState({ visible: false, imageSrc: null, pendingFiles: [] });
        }
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

    const uploadVideoIfNeeded = async () => {
        if (!video) return null;
        try {
            const url = await uploadVideoToCloudinary(video.file, (p) => setVideo(v => v && v.id === video.id ? { ...v, progress: p } : v));
            setVideo(v => v ? { ...v, uploaded: true, url, progress: 100 } : v);
            return { url, duration: video.duration };
        } catch (err) {
            toast.error('Video upload failed');
            return null;
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.caption.trim() && images.length === 0 && !video) { toast.error("Please add a caption, image, or video!"); return; }
        setIsPosting(true);
        let postSucceeded = false;
        let uploadToast = null;
        try {
            let imageURLs = [];
            if (images.length > 0) {
                imageURLs = await uploadAllImages();
                if (imageURLs.length === 0 && images.length > 0) { toast.error('Image upload failed'); setIsPosting(false); return; }
            }

            // Upload voice note if recorded
            let voiceNoteUrl = null, voiceNoteDuration = null;
            if (voiceBlob) {
                // Voice notes are uploaded as video resource type in Cloudinary.
                const voiceFile = new File([voiceBlob], 'voice.webm', { type: voiceBlob.type || 'audio/webm' });
                voiceNoteUrl = await uploadVideoToCloudinary(voiceFile);
                voiceNoteDuration = recordingDuration;
            }

            // Upload video if attached
            let videoUrl = null, videoDuration = null;
            if (video) {
                const v = await uploadVideoIfNeeded();
                if (!v) { toast.error('Video upload failed'); setIsPosting(false); return; }
                videoUrl = v.url; videoDuration = v.duration;
            }

            // Detect mood from caption
            let mood = null;
            try {
                uploadToast = toast.loading("Posting your masterpiece...");
                const moodRes = await api.post(`/api/ai/detect-mood`, { caption: formData.caption });
                mood = moodRes.data.mood;
            } catch { }

            const postData = {
                ...formData, loggeduser: loggeduser?._id, imageURLs,
                location: location.name ? location : null,
                music: music.title ? music : null,
                isAnonymous,
                expiresAt: expiresIn ? new Date(Date.now() + parseInt(expiresIn) * 3600000).toISOString() : null,
                unlocksAt: unlocksAt || null,
                collaboratorIds: collaborators.map(c => c._id),
                voiceNoteUrl, voiceNoteDuration,
                videoURL: videoUrl, videoDuration,
                mood,
                isAiGenerated: usedAiForThisPost,
                poll: openFeaturePanel === 'poll' && pollOptions.filter(o => o.trim()).length >= 2 ? {
                    options: pollOptions.filter(o => o.trim()).map(o => ({ text: o, votes: [] })),
                    correctOptionIndex: isQuiz ? correctOptionIndex : null
                } : null,
                groupId: selectedGroupId,
                isCollaborative,
            };

            const response = await createPostMutation.mutateAsync(postData);
            const data = response?.data;

            if (data?._id) {
                postSucceeded = true;
                addSocketPost(data);
                images.forEach(img => img.preview && URL.revokeObjectURL(img.preview));
                if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
                setImages([]); setVoiceBlob(null); setVoicePreviewUrl(null); setRecordingDuration(0);
                setFormData({ caption: "", category: "Default" });
                setLocation({ name: '', lat: null, lng: null }); setMusic({ title: '', artist: '' });
                setIsAnonymous(false); setExpiresIn(''); setUnlocksAt('');
                setIsCollaborative(false); setCollaborators([]);
                setSuggestedCaptions([]); setOpenFeaturePanel(null);
                setPollOptions(['', '']); setIsQuiz(false); setCorrectOptionIndex(null);
                setSelectedGroupId(null);
                toast.success("Post created successfully!", { id: uploadToast });
                setnewpostVisible(false);
            } else {
                toast.error(data?.error || "Failed to create post", { id: uploadToast });
            }
        } catch (error) {
            // Only show error toast if the post itself genuinely failed
            if (!postSucceeded) {
                const msg = error?.response?.data?.error || error?.message || "An unexpected error occurred";
                toast.error(msg, { id: uploadToast });
            }
        }
        finally { setIsPosting(false); }
    };

    const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const actionBtnStyle = (active) => ({
        background: active ? '#22c55e' : 'var(--surface-2)',
        border: '1px solid var(--border-color)',
        borderRadius: '999px',
        padding: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        color: active ? '#ffffff' : 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
    });
    return (
        <>
            <div className="new pt-2">
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2 align-items-center justify-between">
                        <div className="flex gap-2 align-items-center">
                            <img src={isAnonymous ? 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff' : (loggeduser?.profile_picture || "default-profile.png")} alt="Profile" className="logo" style={{ borderRadius: '50%' }} />
                            <div>
                                <span className="text-[var(--text-main)] font-semibold">{loggeduser?.fullname}</span>
                                {location.name && <span className="flex items-center text-xs gap-1 text-[var(--text-sub)]">📍 {location.name}<button aria-label="Remove location" type="button" onClick={() => setLocation({ name: '', lat: null, lng: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', fontSize: '12px' }}>✕</button></span>}
                            </div>
                        </div>
                        {myGroups.length > 0 && (
                            <select
                                value={selectedGroupId || ''}
                                onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--border-color)] outline-none focus:border-[#808bf5] cursor-pointer transition"
                            >
                                <option value="">🌐 General Feed</option>
                                {myGroups.map(g => (
                                    <option key={g._id} value={g._id}>👥 {g.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-100">
                        <textarea ref={captionRef} type="text" placeholder={isAnonymous ? "# Share your anonymous confession..." : "# Tell your thoughts to your friends"}
                            className="py-2 px-4 rounded bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] focus:border-[#808bf5] outline-none w-100 placeholder-[var(--text-sub)]" cols={50} rows={5} name="caption" value={formData.caption} onChange={handleChange} />
                        <div className="flex flex-col w-100 gap-2">
                            <div className="flex w-100 flex-wrap justify-around">
                                <button
                                    type="button"
                                    aria-label="Add emoji"
                                    onClick={() => togglePanel('emoji')}
                                    style={actionBtnStyle(openFeaturePanel === 'emoji')}
                                >
                                    😊
                                </button>


                                <button
                                    type="button"
                                    aria-label="Add image or video"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={actionBtnStyle(false)}
                                >
                                    <i className="pi pi-image"></i>
                                </button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    hidden
                                />


                                <button
                                    type="button"
                                    aria-label={location.name ? "Location added" : "Add location"}
                                    onClick={handleGetLocation}
                                    disabled={loadingLocation}
                                    style={actionBtnStyle(!!location.name)}
                                >
                                    {loadingLocation ? (
                                        <i className="pi pi-spin pi-spinner"></i>
                                    ) : (
                                        <i className="pi pi-map-marker"></i>
                                    )}
                                </button>


                                {/* Music
                                <button
                                    type="button"
                                    onClick={() => setShowMusicInput(v => !v)}
                                    style={actionBtnStyle(!!music.title)}
                                >
                                    🎵
                                </button> */}

                                <button
                                    type="button"
                                    aria-label="Use AI features"
                                    onClick={() => togglePanel('ai')}
                                    style={actionBtnStyle(openFeaturePanel === 'ai')}
                                    title="AI Magic"
                                >
                                    ✨
                                </button>
                                <button
                                    type="button"
                                    aria-label="Advanced settings"
                                    onClick={() => togglePanel('advanced')}
                                    style={actionBtnStyle(openFeaturePanel === 'advanced')}
                                >
                                    ⚙️
                                </button>
                                <button
                                    type="button"
                                    aria-label="Add poll"
                                    onClick={() => togglePanel('poll')}
                                    style={actionBtnStyle(openFeaturePanel === 'poll')}
                                    title="Add Poll"
                                >
                                    📊
                                </button>

                                <button
                                    type="submit"
                                    aria-label="Submit post"
                                    disabled={isPosting}
                                    style={{
                                        ...actionBtnStyle(false),
                                        background: '#6366f1',
                                        color: '#fff',
                                        padding: '8px 10px'
                                    }}
                                >
                                    {isPosting ? (
                                        <span className="spinner-border spinner-border-sm text-white" />
                                    ) : (
                                        <i className="pi pi-send"></i>
                                    )}
                                </button>
                            </div>

                            {openFeaturePanel === 'poll' && (
                                <div className="mt-2 p-3 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Poll Options</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsQuiz(!isQuiz)}
                                            className={`text-[10px] px-2.5 py-1 rounded-lg border font-black uppercase tracking-tight transition ${isQuiz ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)]'}`}
                                        >
                                            {isQuiz ? '🎓 Neural Quiz' : '📈 Statistical Poll'}
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {pollOptions.map((opt, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                {isQuiz && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrectOptionIndex(idx)}
                                                        className={`w-6 h-6 rounded-full border flex-shrink-0 flex items-center justify-center transition ${correctOptionIndex === idx ? 'bg-green-500 border-green-600 text-white' : 'border-[var(--border-color)] text-[var(--text-sub)]'}`}
                                                    >
                                                        {correctOptionIndex === idx ? <i className="pi pi-check text-[10px]" /> : idx + 1}
                                                    </button>
                                                )}
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newOpts = [...pollOptions];
                                                        newOpts[idx] = e.target.value;
                                                        setPollOptions(newOpts);
                                                    }}
                                                    placeholder={`Option ${idx + 1}`}
                                                    className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[#808bf5]"
                                                />
                                                {pollOptions.length > 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== idx))}
                                                        className="pi pi-times text-[var(--text-sub)] hover:text-red-500 transition cursor-pointer"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        {pollOptions.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={() => setPollOptions(prev => [...prev, ''])}
                                                className="text-xs text-[#808bf5] font-semibold hover:underline w-fit mt-1"
                                            >
                                                + Add Option
                                            </button>
                                        )}
                                    </div>
                                    {isQuiz && <p className="text-[10px] text-[var(--text-sub)] m-0">Click the number to set the correct answer</p>}
                                </div>
                            )}

                            {/* Group Selection moved to profile header */}

                            <div className="flex flex-col gap-2">
                                {openFeaturePanel === 'emoji' && (
                                    <EmojiPicker
                                        onSelect={(e) => {
                                            handleEmojiSelect(e);
                                            setOpenFeaturePanel(null);
                                        }}
                                        onClose={() => setOpenFeaturePanel(null)}
                                    />
                                )}

                                {video && (
                                    <div className="flex gap-3 items-center mt-2 justify-center">
                                        <video src={video.preview} autoplay loop style={{ maxWidth: '220px', borderRadius: '8px' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Size: {Math.round((video.file.size / (1024 * 1024)) * 10) / 10}MB • {formatDuration(Math.round(video.duration))}</div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button type="button" onClick={() => { URL.revokeObjectURL(video.preview); setVideo(null); }} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', cursor: 'pointer' }}>Remove</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* {music.title && <button type="button" onClick={() => setMusic({ title: '', artist: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' }}>✕</button>}
                                {showMusicInput && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <input type="text" placeholder="Song title" value={music.title} onChange={e => setMusic(p => ({ ...p, title: e.target.value }))} style={{ flex: 1, minWidth: '120px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px' }} />
                                        <input type="text" placeholder="Artist" value={music.artist} onChange={e => setMusic(p => ({ ...p, artist: e.target.value }))} style={{ flex: 1, minWidth: '100px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px' }} />
                                        <button type="button" onClick={() => setShowMusicInput(false)} style={{ padding: '5px 10px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>+</button>
                                    </div>
                                )} */}



                                {openFeaturePanel === 'ai' && (
                                    <div style={{ background: 'var(--surface-1)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '700', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✨ NVIDIA AI Magic</span>
                                            <span style={{ fontSize: '11px', color: (aiLimit.text.remaining === 0 && aiLimit.image.remaining === 0) ? '#ef4444' : 'var(--text-sub)' }}>
                                                Text: {aiLimit.text.remaining}/2 | Image: {aiLimit.image.remaining}/2
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Describe what you want to create..."
                                            value={aiPrompt}
                                            onChange={e => setAiPrompt(e.target.value)}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={generateAiText}
                                                disabled={isGeneratingAi || aiLimit.text.remaining === 0}
                                                style={{ flex: 1, padding: '10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s' }}
                                            >
                                                {isGeneratingAi ? <i className="pi pi-spin pi-spinner"></i> : '📝 Text'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={generateAiImage}
                                                disabled={isGeneratingAi || aiLimit.image.remaining === 0}
                                                style={{ flex: 1, padding: '10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s' }}
                                            >
                                                {isGeneratingAi ? <i className="pi pi-spin pi-spinner"></i> : '🖼️ Image'}
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={generateAiMeta}
                                            disabled={isGeneratingAi}
                                            style={{ width: '100%', padding: '10px', background: 'var(--surface-2)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }}
                                        >
                                            {isGeneratingAi ? <i className="pi pi-spin pi-spinner"></i> : '#️⃣ Suggest hashtags + category'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={generateAndPostAi}
                                            disabled={isGeneratingAi || aiLimit.text.remaining === 0 || aiLimit.image.remaining === 0}
                                            style={{ width: '100%', padding: '12px', background: 'linear-gradient(to right, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'all 0.2s' }}
                                        >
                                            {isGeneratingAi ? 'Generating Content...' : '🚀 One-click AI Generate + Post'}
                                        </button>
                                        {(aiLimit.text.remaining === 0 || aiLimit.image.remaining === 0) && (
                                            <p style={{ fontSize: '11px', color: '#f87171', margin: 0, textAlign: 'center' }}>
                                                {aiLimit.text.remaining === 0 && aiLimit.image.remaining === 0
                                                    ? 'Daily text and image limits reached.'
                                                    : aiLimit.text.remaining === 0
                                                        ? 'Daily text limit reached.'
                                                        : 'Daily image limit reached.'}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Advanced panel */}

                                {openFeaturePanel === 'advanced' && (
                                    <div style={{ background: 'var(--surface-1)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>

                                        {/* Anonymous */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-main)', padding: '4px' }}>
                                            <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] focus:ring-[#6366f1]" />
                                            <div className="flex flex-col">
                                                <span className="font-semibold">🎭 Post anonymously</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Your identity will be hidden from everyone</span>
                                            </div>
                                        </label>

                                        {/* Expiry */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', color: 'var(--text-main)', padding: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600' }} className="flex items-center gap-2">⏳ Auto-delete after</span>
                                            <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)}
                                                style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }}>
                                                <option value="">Never (Keep forever)</option>
                                                <option value="1">1 hour</option>
                                                <option value="6">6 hours</option>
                                                <option value="24">24 hours</option>
                                                <option value="72">3 days</option>
                                                <option value="168">1 week</option>
                                            </select>
                                        </div>

                                        {/* Time-lock */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', color: 'var(--text-main)', padding: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600' }} className="flex items-center gap-2">🔒 Unlock at</span>
                                            <div className="flex-1 flex gap-2">
                                                <input type="datetime-local" value={unlocksAt} onChange={e => setUnlocksAt(e.target.value)}
                                                    min={new Date().toISOString().slice(0, 16)}
                                                    style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }} />
                                                {unlocksAt && <button type="button" onClick={() => setUnlocksAt('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px' }}>✕</button>}
                                            </div>
                                        </div>

                                        {/* Collaborative */}
                                        <div style={{ padding: '4px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', marginBottom: '8px' }}>
                                                <input type="checkbox" checked={isCollaborative} onChange={e => setIsCollaborative(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] focus:ring-[#6366f1]" />
                                                <span className="font-semibold">🤝 Collaborative post</span>
                                            </label>
                                            {isCollaborative && (
                                                <div style={{ position: 'relative' }}>
                                                    <input type="text" placeholder="Search collaborators..." value={collaboratorSearch} onChange={e => setCollaboratorSearch(e.target.value)}
                                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px', boxSizing: 'border-box' }} />
                                                    {collabResults.length > 0 && (
                                                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: '8px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '12px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                                                            {collabResults.map(u => (
                                                                <button key={u._id} type="button" onClick={() => addCollaborator(u)}
                                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-main)', transition: 'background 0.2s' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-1)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                >
                                                                    <img src={u.profile_picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectCover: 'cover' }} />
                                                                    <div className="flex flex-col">
                                                                        <span style={{ fontSize: '13px', fontWeight: '600' }}>{u.fullname}</span>
                                                                        <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>@{u.username}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {collaborators.length > 0 && (
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                                            {collaborators.map(c => (
                                                                <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-main)' }}>
                                                                    <img src={c.profile_picture} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />
                                                                    <span className="font-medium">{c.fullname}</span>
                                                                    <button type="button" onClick={() => setCollaborators(prev => prev.filter(x => x._id !== c._id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px', padding: 0, marginLeft: '2px' }}>✕</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Voice note */}
                                        <div style={{ padding: '4px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 10px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>🎤 Voice Message</p>
                                            {!voicePreviewUrl ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <button type="button" onClick={isRecording ? stopRecording : startRecording}
                                                        style={{ padding: '8px 20px', background: isRecording ? '#ef4444' : '#6366f1', color: '#fff', border: 'none', borderRadius: '99px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                                                        {isRecording ? <><span className="w-2 h-2 bg-white rounded-full animate-pulse mr-1" /> Stop {formatDuration(recordingDuration)}</> : <><i className="pi pi-microphone" /> Record Voice</>}
                                                    </button>
                                                    {isRecording && <div className="flex gap-1">
                                                        {[1, 2, 3].map(i => <div key={i} className="w-1 bg-[#ef4444] rounded-full animate-bounce" style={{ height: '12px', animationDelay: `${i * 0.1}s` }} />)}
                                                    </div>}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-2)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                    <i className="pi pi-volume-up text-[#6366f1] ml-2" />
                                                    <audio src={voicePreviewUrl} controls style={{ height: '32px', flex: 1 }} />
                                                    <button type="button" onClick={() => { setVoiceBlob(null); setVoicePreviewUrl(null); setRecordingDuration(0); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: '600', fontSize: '12px', padding: '0 8px' }}>Remove</button>
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
                                                        style={{ textAlign: 'left', padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-main)' }}>
                                                        {cap}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
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
                                {!isPosting && <button aria-label="Remove image" type="button" onClick={() => removeImage(img.id)} style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>}
                            </div>
                        ))}
                        {images.length < 5 && !isPosting && (
                            <div onClick={() => fileInputRef.current?.click()} style={{ width: '80px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', fontSize: '24px' }}>+</div>
                        )}
                    </div>
                )}

                {/* Feature badges */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingLeft: '44px' }}>
                    {isAnonymous && <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', background: 'rgba(128,139,245,0.1)', color: '#808bf5', borderRadius: '12px', padding: '4px 10px', border: '1px solid rgba(128,139,245,0.2)', letterSpacing: '0.05em' }}>🎭 Anonymous</span>}
                    {expiresIn && <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '12px', padding: '4px 10px', border: '1px solid rgba(245,158,11,0.2)', letterSpacing: '0.05em' }}>⏳ {expiresIn}H SPAN</span>}
                    {unlocksAt && <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '12px', padding: '4px 10px', border: '1px solid rgba(239,68,68,0.2)', letterSpacing: '0.05em' }}>🔒 SECURE LOCK</span>}
                    {isCollaborative && <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '12px', padding: '4px 10px', border: '1px solid rgba(16,185,129,0.2)', letterSpacing: '0.05em' }}>🤝 SHARED</span>}
                    {voicePreviewUrl && <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: '12px', padding: '4px 10px', border: '1px solid rgba(59,130,246,0.2)', letterSpacing: '0.05em' }}>🎤 VOICE NODE</span>}
                </div>
            </div>
            <ImageCropper
                visible={croppingState.visible}
                image={croppingState.imageSrc}
                onCropComplete={handleCropComplete}
                onCancel={() => setCroppingState({ visible: false, imageSrc: null, pendingFiles: [] })}
            />
            <Toaster />
        </>
    );
};

export default NewPost;