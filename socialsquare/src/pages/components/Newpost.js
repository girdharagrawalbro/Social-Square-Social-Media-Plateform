import React, { useState, useRef, useEffect } from "react";
import { Geolocation } from '@capacitor/geolocation';
import { useGroups } from '../../hooks/queries/useAuthQueries';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import { useCreatePost } from '../../hooks/queries/usePostQueries';
import toast from "react-hot-toast";
import ImageCropper from './ui/ImageCropper';
import { urlToFile } from "../../utils/nativeUtils";

import { uploadToCloudinary, uploadVideoToCloudinary, validateImageFile, validateImageType, validateVideoFile, validateVideoType } from '../../utils/cloudinary';
import { useSystemFlags } from "../../hooks/queries/useMiscQueries";


import { Dialog } from 'primereact/dialog';

const STEPS = {
    SELECT: 'select',
    AI_PROMPT: 'ai_prompt',
    FINALIZE: 'finalize'
};

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😅', '🥳', '❤️', '🔥', '✨', '🎉', '👍', '🙌', '💯', '🌟', '😭', '🤣', '😊', '🥹', '💪', '🎵', '📍', '🌍', '🍕', '☕', '🌸', '🌈', '👀', '💬'];

const EmojiSelector = ({ onSelect }) => (
    <div className="flex gap-1.5 p-1 overflow-x-auto custom-scrollbar no-scrollbar" style={{ maxHeight: '45px' }}>
        {EMOJIS.map(e => (
            <button
                key={e}
                type="button"
                className="text-xl hover:scale-125 transition-transform p-1 grayscale-[0.5] hover:grayscale-0"
                onClick={() => onSelect(e)}
            >
                {e}
            </button>
        ))}
    </div>
);

const NewPost = ({ visible, onHide }) => {
    const loggeduser = useAuthStore(s => s.user);
    const addSocketPost = usePostStore(s => s.addSocketPost);
    const { data: flags } = useSystemFlags();
    const createPostMutation = useCreatePost();
    const fileInputRef = useRef(null);
    const captionRef = useRef(null);

    const [step, setStep] = useState(STEPS.SELECT);
    const [formData, setFormData] = useState({ caption: "", category: "Default" });
    const [images, setImages] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [activeMediaType, setActiveMediaType] = useState('image'); // 'video' | 'image'
    const [video, setVideo] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [openFeaturePanel, setOpenFeaturePanel] = useState(null);

    // Location & music
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [, setLoadingLocation] = useState(false);
    const [music] = useState({ title: '', artist: '' });

    // Features
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [expiresIn, setExpiresIn] = useState('');
    const [unlocksAt, setUnlocksAt] = useState('');
    const [isCollaborative, setIsCollaborative] = useState(false);
    const [collaborators, setCollaborators] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Voice note
    const [voiceBlob] = useState(null);
    const [recordingDuration] = useState(0);

    // AI
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [usedAiForThisPost, setUsedAiForThisPost] = useState(false);
    const [aiLimits, setAiLimits] = useState({ text: 2, image: 2 });

    // Polls
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [isQuiz] = useState(false);
    const [correctOptionIndex] = useState(null);

    // Groups
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const { data: groups = [] } = useGroups();

    // ── Cropping State ──────────────────────────────────────────────────────
    const [croppingState, setCroppingState] = useState({
        active: false,
        imageSrc: null,
        videoSrc: null,
        pendingFiles: [],
        isVideo: false,
        duration: 60,
        originalFile: null,
        replacingId: null
    });

    const resetState = () => {
        setStep(STEPS.SELECT);
        setFormData({ caption: "", category: "Default" });
        setImages([]);
        setActiveImageIndex(0);
        setActiveMediaType('image');
        setVideo(null);
        setCroppingState({ active: false, imageSrc: null, videoSrc: null, pendingFiles: [], isVideo: false, originalFile: null, replacingId: null });
        setLocation({ name: '', lat: null, lng: null });
        setCollaborators([]);
        setAiPrompt("");
        setPollOptions(['', '']);
        setIsAnonymous(false);
        setExpiresIn('');
        setUnlocksAt('');
        setSelectedGroupId(null);
    };

    const handleCloseInternal = (force = false) => {
        const hasContent = images.length > 0 || video || formData.caption.trim() || aiPrompt.trim();
        if (!force && hasContent) {
            if (window.confirm("Discard post? If you leave now, your changes won't be saved.")) {
                resetState();
                onHide();
            }
        } else {
            resetState();
            onHide();
        }
    };


    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const togglePanel = (panelName) => setOpenFeaturePanel(openFeaturePanel === panelName ? null : panelName);

    useEffect(() => {
        const handleEscapeKey = (event) => { if (event.key === 'Escape') setOpenFeaturePanel(null); };
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


    const handleGetLocation = async () => {
        setLoadingLocation(true);
        try {
            const coordinates = await Geolocation.getCurrentPosition();
            const { latitude: lat, longitude: lng } = coordinates.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                const data = await res.json();
                const name = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
                setLocation({ name, lat, lng });
                toast.success(`📍 ${name}`);
            } catch {
                setLocation({ name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng });
            }
        } catch (err) {
            toast.error('Could not get location. Please enable location permissions.');
            console.error('Geolocation error:', err);
        } finally {
            setLoadingLocation(false);
        }
    };


    const fetchAiLimits = async () => {
        try {
            const res = await api.get('/api/ai/limit');
            setAiLimits({
                text: res.data.text.remaining,
                image: res.data.image.remaining
            });
        } catch (err) { console.error('Failed to fetch AI limits:', err); }
    };

    useEffect(() => {
        if (openFeaturePanel === 'ai') {
            fetchAiLimits();
        }
    }, [openFeaturePanel]);

    const generateAiText = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/generate-text`, { prompt: aiPrompt });
            setFormData(p => ({ ...p, caption: res.data.text }));
            setUsedAiForThisPost(true);
            setAiLimits(prev => ({ ...prev, text: res.data.remaining }));
            toast.success(`✨ Text generated`);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to generate text'); }
        finally { setIsGeneratingAi(false); }
    };

    const generateAiImage = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }
        if (images.length >= 5) { toast.error('Max 5 images reached'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/generate-image`, { prompt: aiPrompt });
            const newImg = { id: Math.random().toString(36).slice(2), preview: res.data.imageUrl, url: res.data.imageUrl, uploaded: true, progress: 100 };
            setImages(prev => {
                const next = [...prev, newImg];
                setActiveImageIndex(next.length - 1);
                return next;
            });
            setUsedAiForThisPost(true);
            setAiLimits(prev => ({ ...prev, image: res.data.remaining }));
            toast.success(`✨ Image generated`);
            return newImg;
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate image');
            return null;
        }
        finally { setIsGeneratingAi(false); }
    };

    const handleAiMagicPost = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }

        // Reset for fresh generation
        setFormData(p => ({ ...p, caption: "" }));
        setImages([]);
        setIsGeneratingAi(true);

        try {
            // Start all tasks using raw aiPrompt
            const textPromise = api.post(`/api/ai/generate-text`, { prompt: aiPrompt });
            const imgPromise = api.post(`/api/ai/generate-image`, { prompt: aiPrompt });
            const metaPromise = api.post(`/api/ai/suggest-meta`, { prompt: aiPrompt });

            // 1. Handle Text & Meta as soon as they arrive (usually faster)
            const [textRes, metaRes] = await Promise.all([textPromise, metaPromise]);

            const suggestedCaption = textRes.data.text;
            const hashtags = metaRes.data.hashtags || [];
            const category = metaRes.data.category || 'Default';

            setFormData(p => ({
                ...p,
                caption: hashtags.length > 0 ? `${suggestedCaption}\n\n${hashtags.join(' ')}` : suggestedCaption,
                category
            }));

            setAiLimits(prev => ({
                ...prev,
                text: textRes.data.textRemaining ?? prev.text
            }));

            // 2. Wait for image (takes longer)
            const imgRes = await imgPromise;

            const newImg = {
                id: Math.random().toString(36).slice(2),
                preview: imgRes.data.imageUrl,
                url: imgRes.data.imageUrl,
                uploaded: true,
                progress: 100
            };

            setImages([newImg]);
            setActiveImageIndex(0);
            setUsedAiForThisPost(true);
            setAiLimits(prev => ({
                ...prev,
                image: imgRes.data.imageRemaining ?? prev.image
            }));

            // Short delay so user can see the generated results before auto-switch
            setTimeout(() => {
                setStep(STEPS.FINALIZE);
                toast.success(`✨ AI Magic Post ready!`);
            }, 1500);

        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate content');
        } finally {
            setIsGeneratingAi(false);
        }
    };




    const handleSearchUsers = async (query) => {
        setSearchTerm(query);
        if (query.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await api.get(`/api/auth/search?query=${query}`);
            // The backend returns { users: [], posts: [] }
            const users = res.data?.users || [];
            setSearchResults(users.filter(u => u._id !== loggeduser._id));
        } catch { }
        finally { setIsSearching(false); }
    };

    const addCollaborator = (user) => {
        if (collaborators.length >= 3) { toast.error("Max 3 collaborators"); return; }
        if (collaborators.some(c => c._id === user._id)) return;
        setCollaborators(prev => [...prev, user]);
        setIsCollaborative(true);
        setSearchTerm("");
        setSearchResults([]);
    };

    const removeCollaborator = (id) => {
        const updated = collaborators.filter(c => c._id !== id);
        setCollaborators(updated);
        if (updated.length === 0) setIsCollaborative(false);
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const videoFile = files.find(f => f.type && f.type.startsWith('video/'));
        if (videoFile) {
            const typeErr = validateVideoType(videoFile);
            if (typeErr) { toast.error(typeErr); e.target.value = ''; return; }

            const sizeWarn = validateVideoFile(videoFile);
            if (sizeWarn) toast.error(sizeWarn);

            const duration = await new Promise((resolve) => {
                const url = URL.createObjectURL(videoFile);
                const vid = document.createElement('video');
                vid.preload = 'metadata'; vid.src = url;
                vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(vid.duration || 0); };
                vid.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
            });
            if (duration === 0) { toast.error('Unable to read video metadata'); e.target.value = ''; return; }

            // Collect any valid image files from the SAME selection so they can be
            // cropped right after the video trim is done (pendingFiles chain).
            const imageFilesInSelection = files
                .filter(f => f !== videoFile && f.type && f.type.startsWith('image/'))
                .filter(f => {
                    const typeErr = validateImageType(f);
                    if (typeErr) { toast.error(typeErr); return false; }
                    const sizeWarn = validateImageFile(f);
                    if (sizeWarn) toast.error(sizeWarn);
                    return true;
                });

            // NOTE: We do NOT clear images here — video and images can coexist in the same post.
            const videoUrl = URL.createObjectURL(videoFile);
            setCroppingState({
                active: true,
                videoSrc: videoUrl,
                imageSrc: null,
                pendingFiles: imageFilesInSelection, // queued for image-crop after video
                isVideo: true,
                originalFile: videoFile,
                duration
            });
            e.target.value = '';
            return;
        }

        // Hard-block wrong file types; oversized images are allowed (Drive fallback)
        const validFiles = files.filter(f => {
            const typeErr = validateImageType(f);
            if (typeErr) { toast.error(typeErr); return false; }
            // Show size warning but still proceed — uploadToCloudinary falls back to Drive
            const sizeWarn = validateImageFile(f);
            if (sizeWarn) toast.error(sizeWarn);
            return true; // allow through regardless of size
        });
        if (validFiles.length === 0) { e.target.value = ''; return; }

        const first = validFiles[0];
        const reader = new FileReader();
        reader.onload = () => {
            setImages([]);
            setCroppingState({
                active: true,
                imageSrc: reader.result,
                videoSrc: null,
                pendingFiles: validFiles.slice(1),
                isVideo: false,
                originalFile: first
            });
        };
        reader.readAsDataURL(first);
        e.target.value = '';
    };

    const handleNativeCapture = async (source) => {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: source // CameraSource.Camera or CameraSource.Photos
            });

            if (image.webPath) {
                const file = await urlToFile(image.webPath, `captured-${Date.now()}.jpg`, 'image/jpeg');

                setImages([]);
                setCroppingState({
                    active: true,
                    imageSrc: image.webPath, // resultType: Uri gives webPath
                    videoSrc: null,
                    pendingFiles: [],
                    isVideo: false,
                    originalFile: file
                });
            }
        } catch (error) {
            // User likely cancelled
            console.log('Native capture cancelled or failed', error);
        }
    };

    const handleCropComplete = async (result) => {
        let newMediaObj = null;

        if (croppingState.isVideo) {
            newMediaObj = {
                file: croppingState.originalFile,
                preview: croppingState.videoSrc,
                url: null, progress: 0, uploaded: false,
                id: Math.random().toString(36).slice(2),
                isVideo: true,
                duration: result.trimRange ? (result.trimRange[1] - result.trimRange[0]) : croppingState.duration,
                trimRange: result.trimRange
            };
            setVideo(newMediaObj);
            setActiveMediaType('video'); // Switch preview to show the newly added video
            // NOTE: images are NOT cleared — video and images can coexist in the same post.

            if (croppingState.pendingFiles.length > 0) {
                // There are image files queued from the same selection — chain into image cropping
                const nextFile = croppingState.pendingFiles[0];
                const reader = new FileReader();
                reader.onload = () => {
                    setCroppingState({
                        active: true,
                        imageSrc: reader.result,
                        videoSrc: null,
                        pendingFiles: croppingState.pendingFiles.slice(1),
                        isVideo: false,
                        originalFile: nextFile
                    });
                };
                reader.readAsDataURL(nextFile);
                // Don't navigate to FINALIZE yet — still need to crop the queued images
            } else {
                setCroppingState(prev => ({ ...prev, active: false }));
                setStep(STEPS.FINALIZE);
            }
        } else {
            if (croppingState.replacingId) {
                setImages(prev => prev.map(img => {
                    if (img.id === croppingState.replacingId) {
                        return {
                            ...img,
                            file: result.croppedFile,
                            preview: URL.createObjectURL(result.croppedFile),
                            originalFile: croppingState.originalFile || img.originalFile,
                            url: null,
                            uploaded: false,
                            progress: 0
                        };
                    }
                    return img;
                }));
                setCroppingState(prev => ({ ...prev, active: false, replacingId: null }));
            } else {
                newMediaObj = {
                    file: result.croppedFile,
                    preview: URL.createObjectURL(result.croppedFile),
                    originalFile: croppingState.originalFile,
                    url: null, progress: 0, uploaded: false,
                    id: Math.random().toString(36).slice(2),
                    isVideo: false
                };

                const updatedImages = [...images, newMediaObj];
                setImages(updatedImages);
                setActiveImageIndex(updatedImages.length - 1);

                if (croppingState.pendingFiles.length > 0) {
                    const nextFile = croppingState.pendingFiles[0];
                    const reader = new FileReader();
                    reader.onload = () => {
                        setCroppingState(prev => ({
                            ...prev,
                            imageSrc: reader.result,
                            pendingFiles: prev.pendingFiles.slice(1),
                            originalFile: nextFile
                        }));
                    };
                    reader.readAsDataURL(nextFile);
                } else {
                    setCroppingState(prev => ({ ...prev, active: false }));
                    setStep(STEPS.FINALIZE);
                }
            }
        }
    };

    const handleEditImage = (img) => {
        const fileToCrop = img.originalFile || img.file;
        const reader = new FileReader();
        reader.onload = () => {
            setCroppingState({
                active: true,
                imageSrc: reader.result,
                videoSrc: null,
                pendingFiles: [],
                isVideo: false,
                originalFile: fileToCrop,
                replacingId: img.id
            });
        };
        reader.readAsDataURL(fileToCrop);
    };

    const handleCropBack = () => {
        const currentFile = croppingState.originalFile;

        if (images.length > 0) {
            const lastImage = images[images.length - 1];
            setImages(prev => prev.slice(0, -1));

            const fileToCrop = lastImage.originalFile || lastImage.file;
            const reader = new FileReader();
            reader.onload = () => {
                setCroppingState(prev => ({
                    ...prev,
                    active: true,
                    imageSrc: reader.result,
                    videoSrc: null,
                    isVideo: false,
                    originalFile: fileToCrop,
                    replacingId: lastImage.id,
                    pendingFiles: currentFile ? [currentFile, ...prev.pendingFiles] : prev.pendingFiles
                }));
            };
            reader.readAsDataURL(fileToCrop);
        } else if (video) {
            const videoToCrop = video;
            setVideo(null);

            setCroppingState(prev => ({
                ...prev,
                active: true,
                videoSrc: videoToCrop.preview,
                imageSrc: null,
                isVideo: true,
                originalFile: videoToCrop.file,
                duration: videoToCrop.duration || 60,
                pendingFiles: currentFile ? [currentFile, ...prev.pendingFiles] : prev.pendingFiles
            }));
        }
    };

    // eslint-disable-next-line no-unused-vars
    const uploadAllImages = async () => {
        const pending = images.filter(img => !img.uploaded);
        const uploaded = [...images];
        let hasError = false;
        await Promise.all(pending.map(async (img) => {
            const idx = uploaded.findIndex(i => i.id === img.id);
            try {
                const result = await uploadToCloudinary(img.file, (p) => setImages(prev => prev.map(i => i.id === img.id ? { ...i, progress: p } : i)), { folder: 'posts' });
                const url = typeof result === 'string' ? result : result?.url;
                uploaded[idx] = { ...uploaded[idx], url, uploaded: true, progress: 100 };
            } catch {
                toast.error(`Failed: ${img.file?.name || 'Image'}`);
                hasError = true;
            }
        }));
        setImages(uploaded);
        if (hasError) throw new Error("Image upload failed");
        return uploaded.filter(i => i.uploaded).map(i => i.url);
    };

    // eslint-disable-next-line no-unused-vars
    const uploadVideoIfNeeded = async () => {
        if (!video) return null;
        try {
            const options = { folder: 'posts' };
            if (video.trimRange) {
                options.start_offset = video.trimRange[0];
                options.end_offset = video.trimRange[1];
            }
            const result = await uploadVideoToCloudinary(video.file, (p) => setVideo(v => v && v.id === video.id ? { ...v, progress: p } : v), options);
            const url = typeof result === 'string' ? result : result?.url;
            const thumbnailUrl = result?.thumbnailUrl || null;
            setVideo(v => v ? { ...v, uploaded: true, url, progress: 100 } : v);
            return {
                url,
                thumbnailUrl,
                duration: video.trimRange ? (video.trimRange[1] - video.trimRange[0]) : video.duration
            };
        } catch (err) { toast.error('Video upload failed'); return null; }
    };

    const handleSubmit = async () => {
        if (!formData.caption.trim() && images.length === 0 && !video) { toast.error("Please add a caption, image, or video!"); return; }

        // 1. Take snapshot of current state
        const imagesToUpload = [...images];
        const videoToUpload = video ? { ...video } : null;
        const postFormData = { ...formData };
        const voiceBlobToUpload = voiceBlob;
        const recDuration = recordingDuration;
        const loc = location.name ? { ...location } : null;
        const mus = music.title ? { ...music } : null;
        const isAnon = isAnonymous;
        const exp = expiresIn;
        const unl = unlocksAt;
        const col = [...collaborators];
        const aiGen = usedAiForThisPost;
        const poll = openFeaturePanel === 'poll' && pollOptions.filter(o => o.trim()).length >= 2 ? {
            options: pollOptions.filter(o => o.trim()).map(o => ({ text: o, votes: [] })),
            correctOptionIndex: isQuiz ? correctOptionIndex : null
        } : null;
        const grp = selectedGroupId;
        const isCollab = isCollaborative;

        // 2. Close popup with 1s delay for better UX
        setIsPosting(true);
        setTimeout(() => {
            setIsPosting(false);
            onHide();
            resetState();
        }, 1000);

        // 3. Start background upload toast
        const uploadToast = toast.loading("Posting...", {
            position: 'bottom-right'
        });

        // 4. Run background task
        (async () => {
            try {
                const batchId = Math.random().toString(36).substring(2, 10) + '-' + Date.now();
                const folderPath = `posts/${batchId}`;

                let imageURLs = [];
                if (imagesToUpload.length > 0) {
                    const pending = imagesToUpload.filter(img => !img.uploaded);
                    const uploaded = [...imagesToUpload];

                    await Promise.all(pending.map(async (img) => {
                        const idx = uploaded.findIndex(i => i.id === img.id);
                        try {
                            const result = await uploadToCloudinary(img.file, null, { folder: folderPath });
                            const url = typeof result === 'string' ? result : result?.url;
                            uploaded[idx] = { ...uploaded[idx], url, uploaded: true };
                        } catch (err) {
                            console.error(`Failed to upload ${img.file?.name}`, err);
                            throw new Error(`Failed to upload ${img.file?.name || 'Image'}`);
                        }
                    }));
                    imageURLs = uploaded.filter(i => i.uploaded).map(i => i.url);
                }

                let voiceNoteUrl = null, voiceNoteDuration = null;
                if (voiceBlobToUpload) {
                    const voiceFile = new File([voiceBlobToUpload], 'voice.webm', { type: voiceBlobToUpload.type || 'audio/webm' });
                    const result = await uploadVideoToCloudinary(voiceFile, null, { folder: folderPath });
                    voiceNoteUrl = typeof result === 'string' ? result : result?.url;
                    voiceNoteDuration = recDuration;
                }

                let videoUrl = null, videoDuration = null, videoThumbnail = null;
                if (videoToUpload) {
                    const options = { folder: folderPath };
                    if (videoToUpload.trimRange) {
                        options.start_offset = videoToUpload.trimRange[0];
                        options.end_offset = videoToUpload.trimRange[1];
                    }
                    const result = await uploadVideoToCloudinary(videoToUpload.file, null, options);
                    videoUrl = typeof result === 'string' ? result : result?.url;
                    videoThumbnail = result?.thumbnailUrl || null;
                    videoDuration = videoToUpload.trimRange ? (videoToUpload.trimRange[1] - videoToUpload.trimRange[0]) : videoToUpload.duration;
                }

                let mood = null;
                if (postFormData.caption?.trim()) {
                    try {
                        const moodRes = await api.post(`/api/ai/detect-mood`, { caption: postFormData.caption });
                        mood = moodRes.data.mood;
                    } catch { }
                }

                const postData = {
                    ...postFormData, loggeduser: loggeduser?._id, imageURLs,
                    location: loc, music: mus, isAnonymous: isAnon,
                    expiresAt: exp ? new Date(Date.now() + parseInt(exp) * 3600000).toISOString() : null,
                    unlocksAt: unl || null,
                    collaboratorIds: col.map(c => c._id),
                    voiceNoteUrl, voiceNoteDuration,
                    videoURL: videoUrl, videoDuration, videoThumbnail, mood,
                    isAiGenerated: aiGen,
                    poll, groupId: grp, isCollaborative: isCollab,
                };

                const response = await createPostMutation.mutateAsync(postData);
                if (response?.data?._id) {
                    addSocketPost(response.data);
                    toast.success("Post shared successfully!", { id: uploadToast });

                    if (response.data.isFirstPost) {
                        import('../../utils/confettiUtils').then(({ fireSleekBalloons }) => {
                            fireSleekBalloons();
                        });
                    }
                } else {
                    toast.error("Failed to create post", { id: uploadToast });
                }
            } catch (error) {
                toast.error(error?.message || "Error occurred while posting", { id: uploadToast });
            }
        })();
    };


    const renderHeader = () => {
        const title = "Create new post";

        return (
            <div className="flex items-center justify-between px-2 py-2 border-b  border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                    {step !== STEPS.SELECT && (
                        <button onClick={() => setStep(STEPS.SELECT)} className="text-[var(--text-main)] text-xl p-1 hover:bg-[var(--surface-2)] rounded-full transition">
                            <i className="pi pi-arrow-left"></i>
                        </button>
                    )}
                </div>

                <h2 className="text-sm font-bold text-[var(--text-main)] m-0">{title}</h2>

                <button
                    onClick={handleSubmit}
                    disabled={isPosting}
                    className="text-[#6366f1] text-sm font-bold hover:text-[#818cf8] transition disabled:opacity-50 flex items-center gap-2"
                >
                    {isPosting && <i className="pi pi-spinner pi-spin text-xs"></i>}
                    {step === STEPS.SELECT ? "" : (isPosting ? "Posting..." : "Post")}
                </button>
            </div>
        );
    };

    const renderSelect = () => (
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 min-h-[500px] text-center gap-6">
            <div className="text-6xl text-[var(--text-sub)] opacity-40">
                <i className="pi pi-images"></i>
            </div>
            <div className="flex flex-col gap-2">
                <h3 className="text-xl text-[var(--text-main)] font-medium m-0">Create new post</h3>
                <p className="text-xs text-[var(--text-sub)]">Share photos and videos with your friends</p>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-[400px]">
                <div className="flex flex-col sm:flex-row gap-3">
                    {Capacitor.isNativePlatform() ? (
                        <>
                            <button
                                onClick={() => handleNativeCapture(CameraSource.Camera)}
                                className="flex-1 bg-[#6366f1] text-white px-4 py-3 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                <i className="pi pi-camera text-sm"></i>
                                Take Photo
                            </button>
                            <button
                                onClick={() => handleNativeCapture(CameraSource.Photos)}
                                className="flex-1 bg-[var(--surface-2)] text-[var(--text-main)] px-4 py-3 rounded-xl font-bold hover:bg-[var(--surface-3)] transition flex items-center justify-center gap-2 border border-[var(--border-color)]"
                            >
                                <i className="pi pi-images text-sm"></i>
                                Gallery
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 bg-[var(--surface-2)] text-[var(--text-main)] px-4 py-3 rounded-xl font-bold hover:bg-[var(--surface-3)] transition flex items-center justify-center gap-2 border border-[var(--border-color)]"
                        >
                            <i className="pi pi-upload text-sm"></i>
                            Upload Media
                        </button>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => setStep(STEPS.FINALIZE)}
                        className="flex-1 bg-[var(--surface-2)] text-[var(--text-main)] px-4 py-3 rounded-xl font-bold hover:bg-[var(--surface-3)] transition flex items-center justify-center gap-2 border border-[var(--border-color)]"
                    >
                        <i className="pi pi-pencil text-sm"></i>
                        Text Post
                    </button>
                    {flags?.ai_features !== false && (
                        <button
                            onClick={() => setStep(STEPS.AI_PROMPT)}
                            className="flex-1 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white px-4 py-3 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <i className="pi pi-sparkles text-sm"></i>
                            AI Magic Post
                        </button>
                    )}
                </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} hidden />
        </div>
    );

    const renderAiPrompt = () => (
        <div className="flex flex-col items-center p-0 h-full bg-[var(--surface-1)] overflow-y-auto custom-scrollbar">
            <div className="w-full flex flex-col bg-[var(--surface-1)] min-h-full">
                <div className="p-4 flex flex-col gap-4">
                    {/* User Header */}
                    <div className="flex items-center gap-3">
                        <img src={loggeduser?.profile_picture} className="w-9 h-9 rounded-full object-cover border border-[var(--border-color)]" alt="" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--text-main)]">{loggeduser?.fullname}</span>
                            <span className="text-[10px] text-[var(--text-sub)]">@{loggeduser?.username}</span>
                        </div>
                    </div>

                    {/* AI Prompt Input Area */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider">AI Generation Prompt</span>
                            <span className="text-[9px] font-bold text-[var(--text-sub)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
                                Remaining: {aiLimits.text} Text / {aiLimits.image} Image
                            </span>
                        </div>
                        <textarea
                            autoFocus
                            placeholder="Describe your post idea... (e.g. A futuristic city in the clouds, cinematic style)"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="w-full bg-transparent border rounded text-[var(--text-main)] text-sm resize-none outline-none border-none placeholder-[var(--text-sub)] leading-relaxed p-2 min-h-[10px]"
                        />

                        {/* AI Image Preview Area */}
                        {(isGeneratingAi || images.length > 0) && (
                            <div className="relative rounded-xl overflow-hidden border border-indigo-500/20 aspect-video h-24 group shadow-inner">
                                {images.length > 0 ? (
                                    <img
                                        src={images[0].preview}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        alt="AI Generated"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 ">
                                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest animate-pulse">Painting your vision...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Generated Caption Area */}
                        {isGeneratingAi && !formData.caption ? (
                            <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 animate-pulse mb-2">
                                <div className="h-2 w-16 bg-indigo-500/20 rounded mb-2"></div>
                                <div className="h-3 w-full bg-indigo-500/10 rounded mb-1.5"></div>
                                <div className="h-3 w-4/5 bg-indigo-500/10 rounded"></div>
                            </div>
                        ) : formData.caption && (
                            <div className=" p-3 rounded-xl border border-indigo-500/10 animate-in fade-in slide-in-from-top-2 duration-300 mb-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">AI Generated Caption</span>
                                    <span className="text-[8px] text-[var(--text-sub)]">Editable</span>
                                </div>
                                <textarea
                                    value={formData.caption}
                                    onChange={(e) => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                                    className="w-full bg-transparent text-[var(--text-main)] text-xs resize-none outline-none border-none leading-relaxed min-h-[60px]"
                                    placeholder="Reviewing AI caption..."
                                />
                            </div>
                        )}
                        <EmojiSelector onSelect={(emoji) => setAiPrompt(prev => prev + emoji)} />
                    </div>

                    {/* Post Settings */}
                    <div className="flex flex-col gap-0 border-t border-[var(--border-color)]">
                        {/* Community Picker */}
                        <div className="flex items-center justify-between py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group relative">
                            <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                <i className="pi pi-globe text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>
                                Share to Community
                            </span>
                            <select
                                value={selectedGroupId || ""}
                                onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1] max-w-[180px] truncate"
                            >
                                <option value="">🌍 General Feed</option>
                                {groups && groups.map(g => (
                                    <option key={g._id} value={g._id}>👥 {g.name}</option>
                                ))}
                            </select>
                        </div>

                        <button onClick={handleGetLocation} className="flex items-center justify-between  py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group">
                            <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                <i className="pi pi-map-marker text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>
                                {location.name || "Add Location"}
                            </span>
                            <i className="pi pi-chevron-right text-[10px] opacity-30 group-hover:opacity-100"></i>
                        </button>

                        <button onClick={() => togglePanel('collab')} className="flex items-center justify-between  py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group">
                            <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                <i className="pi pi-users text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>
                                {collaborators.length > 0 ? `${collaborators.length} Collaborators` : "Add Collaborators"}
                            </span>
                            <i className="pi pi-chevron-right text-[10px] opacity-30 group-hover:opacity-100"></i>
                        </button>
                        {openFeaturePanel === 'collab' && (
                            <div className="p-3 bg-[var(--surface-2)]/50 flex flex-col gap-3 animate-in slide-in-from-top-2">
                                <div className="relative">
                                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] text-[10px]"></i>
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchTerm}
                                        onChange={(e) => handleSearchUsers(e.target.value)}
                                        className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl py-2 pl-8 pr-3 text-[11px] text-[var(--text-main)] outline-none focus:border-[#6366f1]"
                                    />
                                </div>
                                {collaborators.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]/30">
                                        {collaborators.map(user => (
                                            <div key={user._id} className="flex items-center gap-1.5 bg-[var(--surface-1)] border border-[#6366f1]/30 pl-1 pr-2 py-1 rounded-full">
                                                <img src={user.profile_picture} className="w-5 h-5 rounded-full object-cover" alt="" />
                                                <span className="text-[10px] font-medium text-[var(--text-main)]">{user.username}</span>
                                                <button onClick={() => removeCollaborator(user._id)} className="hover:text-red-500">
                                                    <i className="pi pi-times text-[8px]"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border-b border-[var(--border-color)]/50">
                            <button onClick={() => togglePanel('advanced')} className="flex items-center justify-between w-full  py-3 px-1 hover:bg-[var(--surface-2)] transition-colors group">
                                <span className="text-sm text-[var(--text-main)] font-medium">Advanced Settings</span>
                                <i className={`pi pi-chevron-${openFeaturePanel === 'advanced' ? 'up' : 'down'} text-[10px] opacity-30 group-hover:opacity-100`}></i>
                            </button>
                            {openFeaturePanel === 'advanced' && (
                                <div className="p-4 bg-[var(--surface-2)]/50 flex flex-col gap-4 animate-in slide-in-from-top-2">
                                    {flags?.anonymous_posts !== false && (
                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-[var(--text-main)]">Post Anonymously</span>
                                                <span className="text-[10px] text-[var(--text-sub)]">Hide your identity</span>
                                            </div>
                                            <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] accent-[#6366f1]" />
                                        </label>
                                    )}
                                    <div className="flex pt-1 flex-col gap-2">
                                        <span className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider opacity-60">Auto-delete</span>
                                        <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)} className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg p-2 text-xs text-[var(--text-main)] outline-none">
                                            <option value="">Never</option>
                                            <option value="24">24 Hours</option>
                                            <option value="168">7 Days</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>



                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(STEPS.SELECT)}
                            disabled={isGeneratingAi}
                            className="flex-1 py-3 px-4 rounded-xl font-bold text-[var(--text-sub)] hover:bg-[var(--surface-2)] transition disabled:opacity-50"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleAiMagicPost}
                            disabled={isGeneratingAi || !aiPrompt.trim()}
                            className="flex-[2] bg-gradient-to-tr from-indigo-600 to-purple-600 text-white py-2 px-6 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 disabled:opacity-50"
                        >
                            {isGeneratingAi ? (
                                <>
                                    <i className="pi pi-spin pi-spinner text-sm"></i>
                                    Creating Magic...
                                </>
                            ) : (
                                <>
                                    <i className="pi pi-sparkles text-sm"></i>
                                    Generate Magic Post
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderFinalize = () => {
        const hasMedia = images.length > 0 || video;

        return (
            <div className={`flex flex-col md:flex-row w-full h-[calc(100vh-120px)] md:h-[calc(90vh-45px)] md:max-h-[600px] ${!hasMedia ? 'justify-center' : ''}`}>
                {/* Left: Media Preview */}
                {hasMedia && (
                    <div className="w-full h-[40vh] md:h-auto md:w-[60%] bg-black flex flex-col items-center justify-center p-0 relative flex-shrink-0">
                        {/* Main media display */}
                        <div className="flex-1 flex h-[40vh] items-center justify-center w-full relative">
                            {activeMediaType === 'video' && video ? (
                                <video src={video.preview} autoPlay muted loop className="w-full h-full object-contain" />
                            ) : (
                                images.length > 0 && (
                                    <img
                                        src={images[activeImageIndex]?.preview || images[0]?.preview}
                                        key={images[activeImageIndex]?.preview || images[0]?.preview}
                                        className="w-full h-full object-contain"
                                        alt="preview"
                                    />
                                )
                            )}
                            {/* Remove active media button */}
                            <button
                                onClick={() => {
                                    if (activeMediaType === 'video') {
                                        setVideo(null);
                                        if (images.length > 0) {
                                            setActiveMediaType('image');
                                            setActiveImageIndex(0);
                                        }
                                    } else {
                                        const updatedImages = images.filter((_, idx) => idx !== activeImageIndex);
                                        setImages(updatedImages);
                                        if (updatedImages.length > 0) {
                                            setActiveImageIndex(Math.max(0, activeImageIndex - 1));
                                        } else if (video) {
                                            setActiveMediaType('video');
                                        }
                                    }
                                }}
                                title="Remove current media"
                                className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white text-[10px] font-bold p-2 rounded-lg flex items-center justify-center border border-white/20 backdrop-blur transition-all cursor-pointer z-10"
                            >
                                <i className="pi pi-trash text-[12px]"></i>
                            </button>
                            {/* Recrop active image button */}
                            {activeMediaType === 'image' && images.length > 0 && (
                                <button
                                    onClick={() => handleEditImage(images[activeImageIndex])}
                                    title="Recrop image"
                                    className="absolute top-2 right-12 bg-black/60 hover:bg-[#6366f1] text-white text-[10px] font-bold p-2 rounded-lg flex items-center justify-center border border-white/20 backdrop-blur transition-all cursor-pointer z-10"
                                >
                                    <i className="pi pi-pencil text-[12px]"></i>
                                </button>
                            )}
                            {/* Add more images button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                title="Add more images"
                                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-white/20 backdrop-blur transition-all"
                            >
                                <i className="pi pi-plus text-[9px]"></i>
                                Add Image
                            </button>
                        </div>
                        {/* Unified thumbnail strip — shown whenever there is a video, or 1+ images */}
                        {(video || images.length > 0) ? (
                            <div className="w-full p-2 bg-black/40 backdrop-blur-md flex gap-2 overflow-x-auto no-scrollbar border-t border-white/10">
                                {/* Video thumbnail */}
                                {video && (
                                    <div className="relative group flex-shrink-0">
                                        <div
                                            onClick={() => setActiveMediaType('video')}
                                            className={`w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative ${activeMediaType === 'video' ? 'border-[#6366f1]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        >
                                            <video src={video.preview} className="w-full h-full object-cover" muted />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                <i className="pi pi-play text-white text-xs"></i>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVideo(null);
                                                if (images.length > 0) {
                                                    setActiveMediaType('image');
                                                    setActiveImageIndex(0);
                                                }
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white/20 shadow-md cursor-pointer z-10"
                                        >
                                            <i className="pi pi-times text-[8px] font-bold"></i>
                                        </button>
                                    </div>
                                )}
                                {/* Image thumbnails */}
                                {images.map((img, idx) => (
                                    <div key={img.id} className="relative group flex-shrink-0">
                                        <div
                                            onClick={() => { setActiveMediaType('image'); setActiveImageIndex(idx); }}
                                            className={`w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${activeMediaType === 'image' && idx === activeImageIndex ? 'border-[#6366f1]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        >
                                            <img src={img.preview} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const updatedImages = images.filter((_, i) => i !== idx);
                                                setImages(updatedImages);
                                                if (activeImageIndex >= updatedImages.length) {
                                                    setActiveImageIndex(Math.max(0, updatedImages.length - 1));
                                                }
                                                if (updatedImages.length === 0 && video) {
                                                    setActiveMediaType('video');
                                                }
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white/20 shadow-md cursor-pointer z-10"
                                        >
                                            <i className="pi pi-times text-[8px] font-bold"></i>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditImage(img);
                                            }}
                                            title="Recrop image"
                                            className="absolute -bottom-1 -right-1 bg-[#6366f1] hover:bg-[#818cf8] text-white w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white/20 shadow-md cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <i className="pi pi-pencil text-[8px] font-bold"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Right: metadata & controls */}
                <div className={`w-full ${hasMedia ? 'md:w-[40%] border-l' : 'md:w-[500px]'} flex flex-col bg-[var(--surface-1)] border-[var(--border-color)] overflow-y-auto custom-scrollbar flex-1`}>
                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <img src={loggeduser?.profile_picture} className="w-9 h-9 rounded-full object-cover border border-[var(--border-color)]" alt="" />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-[var(--text-main)]">{loggeduser?.fullname}</span>
                                <span className="text-[10px] text-[var(--text-sub)]">@{loggeduser?.username}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <textarea
                                ref={captionRef}
                                placeholder="Write a caption..."
                                value={formData.caption}
                                onChange={handleChange}
                                name="caption"
                                rows={3}
                                className="w-full bg-transparent text-[var(--text-main)] text-sm resize-none outline-none border-none placeholder-[var(--text-sub)] leading-relaxed p-2"
                            />
                            <div className="flex justify-end px-2">
                                <span className="text-[10px] text-[var(--text-sub)] font-medium">{formData.caption.length}/2,200</span>
                            </div>
                            <EmojiSelector onSelect={handleEmojiSelect} />
                        </div>

                        <div className="flex flex-col gap-0 border-t border-[var(--border-color)] mt-2">
                            {/* Community Picker */}
                            <div className="flex items-center justify-between py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group relative">
                                <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                    <i className="pi pi-globe text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>
                                    Share to Community
                                </span>
                                <select
                                    value={selectedGroupId || ""}
                                    onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1] max-w-[180px] truncate"
                                >
                                    <option value="">🌍 General Feed</option>
                                    {groups && groups.map(g => (
                                        <option key={g._id} value={g._id}>👥 {g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button onClick={handleGetLocation} className="flex items-center justify-between py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group">
                                <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                    <i className="pi pi-map-marker text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>
                                    {location.name || "Add Location"}
                                </span>
                                <i className="pi pi-chevron-right text-[10px] opacity-30 group-hover:opacity-100"></i>
                            </button>

                            <button onClick={() => togglePanel('collab')} className="flex items-center justify-between py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group">
                                <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                    <i className="pi pi-users text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>
                                    {collaborators.length > 0 ? `${collaborators.length} Collaborators` : "Add Collaborators"}
                                </span>
                                <i className="pi pi-chevron-right text-[10px] opacity-30 group-hover:opacity-100"></i>
                            </button>
                            {openFeaturePanel === 'collab' && (
                                <div className="p-3 bg-[var(--surface-2)]/50 flex flex-col gap-3 animate-in slide-in-from-top-2">
                                    <div className="relative">
                                        <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] text-[10px]"></i>
                                        <input
                                            type="text"
                                            placeholder="Search users..."
                                            value={searchTerm}
                                            onChange={(e) => handleSearchUsers(e.target.value)}
                                            className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl py-2 pl-8 pr-3 text-[11px] text-[var(--text-main)] outline-none focus:border-[#6366f1]"
                                        />
                                        {isSearching && <i className="pi pi-spin pi-spinner absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6366f1]"></i>}
                                    </div>

                                    {searchResults.length > 0 && (
                                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar bg-[var(--surface-1)] rounded-xl border border-[var(--border-color)] shadow-xl p-1">
                                            {searchResults.map(user => (
                                                <div
                                                    key={user._id}
                                                    onClick={() => addCollaborator(user)}
                                                    className="flex items-center gap-2 p-2 hover:bg-[var(--surface-2)] rounded-lg cursor-pointer transition-colors"
                                                >
                                                    <img src={user.profile_picture} className="w-6 h-6 rounded-full object-cover" alt="" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-[var(--text-main)]">{user.fullname}</span>
                                                        <span className="text-[9px] text-[var(--text-sub)]">@{user.username}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {collaborators.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]/30">
                                            {collaborators.map(user => (
                                                <div key={user._id} className="flex items-center gap-1.5 bg-[var(--surface-1)] border border-[#6366f1]/30 pl-1 pr-2 py-1 rounded-full animate-in zoom-in-95">
                                                    <img src={user.profile_picture} className="w-5 h-5 rounded-full object-cover" alt="" />
                                                    <span className="text-[10px] font-medium text-[var(--text-main)]">{user.username}</span>
                                                    <button onClick={() => removeCollaborator(user._id)} className="hover:text-red-500 transition-colors">
                                                        <i className="pi pi-times text-[8px]"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="border-b border-[var(--border-color)]/50">
                                <button onClick={() => togglePanel('advanced')} className="flex items-center justify-between w-full py-3 px-1 hover:bg-[var(--surface-2)] transition-colors group">
                                    <span className="text-sm text-[var(--text-main)] font-medium">Advanced Settings</span>
                                    <i className={`pi pi-chevron-${openFeaturePanel === 'advanced' ? 'up' : 'down'} text-[10px] opacity-30 group-hover:opacity-100`}></i>
                                </button>
                                {openFeaturePanel === 'advanced' && (
                                    <div className="p-3 bg-[var(--surface-2)]/50 flex flex-col gap-4 animate-in slide-in-from-top-2">
                                        {flags?.anonymous_posts !== false && (
                                            <label className="flex items-center justify-between cursor-pointer group">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-[var(--text-main)]">Post Anonymously</span>
                                                    <span className="text-[10px] text-[var(--text-sub)]">Hide your identity</span>
                                                </div>
                                                <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] accent-[#6366f1] transition-all" />
                                            </label>
                                        )}
                                        <div className="flex  pt-1 flex-col gap-2">
                                            <span className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider opacity-60">Auto-delete</span>
                                            <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)} className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg p-2 text-xs text-[var(--text-main)] outline-none">
                                                <option value="">Never</option>
                                                <option value="24">24 Hours</option>
                                                <option value="168">7 Days</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {flags?.ai_features !== false && (
                                <div>
                                    <button onClick={() => togglePanel('ai')} className="flex items-center justify-between w-full py-3 px-1 hover:bg-[var(--surface-2)] transition-colors group text-[#6366f1]">
                                        <span className="text-sm font-bold flex items-center gap-2">
                                            <span className="animate-pulse">✨</span> AI Magic Tools
                                        </span>
                                        <i className={`pi pi-chevron-${openFeaturePanel === 'ai' ? 'up' : 'down'} text-[10px] opacity-30 group-hover:opacity-100`}></i>
                                    </button>
                                    {openFeaturePanel === 'ai' && (
                                        <div className=" flex flex-col gap-3 m-1 animate-in zoom-in-95">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[9px] font-bold text-[var(--text-sub)] uppercase">Remaining: {aiLimits.text} Text / {aiLimits.image} Image</span>
                                                {isGeneratingAi && <i className="pi pi-spin pi-spinner text-[10px] text-[#6366f1]"></i>}
                                            </div>
                                            <input type="text" placeholder="Generate content..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl p-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[#6366f1] shadow-inner" />
                                            <div className="flex gap-2">
                                                <button onClick={generateAiText} disabled={isGeneratingAi} className="flex-1 py-2 bg-[#6366f1] text-white text-[10px] font-bold rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-50">
                                                    {isGeneratingAi ? <i className="pi pi-spin pi-spinner mr-1"></i> : null}
                                                    Generate Text
                                                </button>
                                                <button onClick={generateAiImage} disabled={isGeneratingAi} className="flex-1 py-2 bg-purple-500 text-white text-[10px] font-bold rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-50">
                                                    Generate Image
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <Dialog
                visible={visible}
                onHide={() => handleCloseInternal()}
                showHeader={false}
                dismissableMask={true}
                modal
                baseZIndex={20000}
                style={{ width: '95vw', maxWidth: '900px', border: 'none' }}
                contentStyle={{ padding: 0, overflow: 'hidden', borderRadius: '12px', background: 'var(--surface-1)' }}
                className="new-post-dialog"
            >
                <div className="w-full flex flex-col bg-[var(--surface-1)]">
                    {renderHeader()}
                    <div className="flex-1 overflow-hidden">
                        {step === STEPS.SELECT && renderSelect()}
                        {step === STEPS.AI_PROMPT && renderAiPrompt()}
                        {step === STEPS.FINALIZE && renderFinalize()}
                    </div>
                </div>
            </Dialog>

            <ImageCropper
                visible={croppingState.active}
                image={croppingState.imageSrc}
                video={croppingState.videoSrc}
                duration={croppingState.duration}
                isNextImage={croppingState.pendingFiles.length > 0}
                onCropComplete={handleCropComplete}
                onCancel={() => setCroppingState(prev => ({ ...prev, active: false }))}
                onBack={(step === STEPS.SELECT && (images.length > 0 || !!video)) ? handleCropBack : null}
            />
        </>
    );
};

export default NewPost;
