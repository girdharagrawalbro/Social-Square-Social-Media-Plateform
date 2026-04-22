import React, { useState, useRef, useEffect } from "react";
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import { useCreatePost } from '../../hooks/queries/usePostQueries';
import toast from "react-hot-toast";
import Cropper from "react-easy-crop";

import { uploadToCloudinary, uploadVideoToCloudinary, validateImageFile, validateVideoFile } from '../../utils/cloudinary';
import { Dialog } from 'primereact/dialog';
import { Slider } from 'primereact/slider';

const STEPS = {
    SELECT: 'select',
    PREVIEW: 'preview',
    FINALIZE: 'finalize'
};

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😅', '🥳', '❤️', '🔥', '✨', '🎉', '👍', '🙌', '💯', '🌟', '😭', '🤣', '😊', '🥹', '💪', '🎵', '📍', '🌍', '🍕', '☕', '🌸', '🌈', '👀', '💬'];

const ASPECT_PRESETS = [
    { label: 'Square', value: 1, icon: 'pi-stop' },
    { label: 'Portrait', value: 4 / 5, icon: 'pi-tablet' },
    { label: 'Landscape', value: 16 / 9, icon: 'pi-desktop' }
];

const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => {
            console.error('Image load error:', error);
            reject(error);
        });
        if (!url.startsWith('data:')) {
            image.setAttribute('crossOrigin', 'anonymous');
        }
        image.src = url;
    });

async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Canvas toBlob failed');
                resolve(null);
                return;
            }
            const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
            resolve(file);
        }, 'image/jpeg', 0.9);
    });
}


const EmojiSelector = ({ onSelect }) => (
    <div className="flex flex-wrap gap-1.5 py-2 px-1 overflow-x-auto custom-scrollbar no-scrollbar" style={{ maxHeight: '80px' }}>
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
    const createPostMutation = useCreatePost();
    const fileInputRef = useRef(null);
    const captionRef = useRef(null);

    const [step, setStep] = useState(STEPS.SELECT);
    const [formData, setFormData] = useState({ caption: "", category: "Default" });
    const [images, setImages] = useState([]);
    const [video, setVideo] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [openFeaturePanel, setOpenFeaturePanel] = useState(null);

    // Location & music
    // Location & music
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [, setLoadingLocation] = useState(false);
    const [music] = useState({ title: '', artist: '' });

    // Features
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [expiresIn, setExpiresIn] = useState('');
    const [unlocksAt, setUnlocksAt] = useState('');
    const [isCollaborative] = useState(false);
    const [collaborators, setCollaborators] = useState([]);

    // Voice note
    const [voiceBlob] = useState(null);
    const [recordingDuration] = useState(0);

    // AI
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [usedAiForThisPost, setUsedAiForThisPost] = useState(false);

    // Polls
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [isQuiz] = useState(false);
    const [correctOptionIndex] = useState(null);

    // Groups
    const [selectedGroupId] = useState(null);

    // ── Cropping State ──────────────────────────────────────────────────────
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [aspect, setAspect] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [croppingState, setCroppingState] = useState({
        active: false,
        currentSource: null,
        pendingFiles: [],
        allProcessed: [],
        isVideo: false,
        originalFile: null
    });
    const [isCropperLoaded, setIsCropperLoaded] = useState(false);
    const [trimRange, setTrimRange] = useState([0, 60]);

    const resetState = () => {
        setStep(STEPS.SELECT);
        setFormData({ caption: "", category: "Default" });
        setImages([]);
        setVideo(null);
        setCroppingState({ active: false, currentSource: null, pendingFiles: [], allProcessed: [], isVideo: false });
        setTrimRange([0, 60]);
        setLocation({ name: '', lat: null, lng: null });
        setCollaborators([]);
        setAiPrompt("");
        setPollOptions(['', '']);
        setIsAnonymous(false);
        setExpiresIn('');
        setUnlocksAt('');
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


    const generateAiText = async () => {
        if (!aiPrompt.trim()) { toast.error('Enter a prompt first'); return; }
        setIsGeneratingAi(true);
        try {
            const res = await api.post(`/api/ai/generate-text`, { prompt: aiPrompt });
            setFormData(p => ({ ...p, caption: res.data.text }));
            setUsedAiForThisPost(true);
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
            setImages(prev => [...prev, newImg]);
            setUsedAiForThisPost(true);
            toast.success(`✨ Image generated`);
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to generate image'); }
        finally { setIsGeneratingAi(false); }
    };




    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const videoFile = files.find(f => f.type && f.type.startsWith('video/'));
        if (videoFile) {
            const vErr = validateVideoFile(videoFile);
            if (vErr) { toast.error(vErr); e.target.value = ''; return; }
            const duration = await new Promise((resolve) => {
                const url = URL.createObjectURL(videoFile);
                const vid = document.createElement('video');
                vid.preload = 'metadata'; vid.src = url;
                vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(vid.duration || 0); };
                vid.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
            });
            if (duration === 0) { toast.error('Unable to read video metadata'); e.target.value = ''; return; }
            
            const initialEnd = Math.min(duration, 60);
            setTrimRange([0, initialEnd]);

            if (duration > 60) {
                toast.success('Video selected. Please trim it to max 60 seconds.', { icon: '✂️' });
            }

            // For video, we still set it as the main preview but in cropping mode
            setImages([]);
            const videoUrl = URL.createObjectURL(videoFile);
            setCroppingState({ active: true, currentSource: videoUrl, pendingFiles: [], allProcessed: [], isVideo: true, originalFile: videoFile, duration });
            setIsCropperLoaded(false);
            setStep(STEPS.PREVIEW);
            e.target.value = '';
            return;
        }

        const validFiles = files.filter(f => !validateImageFile(f));
        if (validFiles.length === 0) { e.target.value = ''; return; }

        const first = validFiles[0];
        const reader = new FileReader();
        reader.onload = () => {
            setImages([]);
            setCroppingState({
                active: true,
                currentSource: reader.result,
                pendingFiles: validFiles.slice(1),
                allProcessed: [],
                isVideo: false,
                originalFile: first
            });
            setIsCropperLoaded(false); // Reset loaded state for new media
            setStep(STEPS.PREVIEW);
        };
        reader.readAsDataURL(first);
        e.target.value = '';
    };

    const handleApplyCrop = async () => {
        let processedFile = null;
        let previewUrl = null;

        if (croppingState.isVideo) {
            processedFile = croppingState.originalFile;
            previewUrl = croppingState.currentSource;
        } else {
            try {
                processedFile = await getCroppedImg(croppingState.currentSource, croppedAreaPixels);
                if (processedFile) {
                    previewUrl = URL.createObjectURL(processedFile);
                } else {
                    // Fallback to original if crop fails
                    previewUrl = croppingState.currentSource;
                }
            } catch (err) {
                console.error('Crop failed:', err);
                previewUrl = croppingState.currentSource;
            }
            if (!processedFile && croppingState.originalFile) {
                processedFile = croppingState.originalFile;
            }
        }

        const newImgObj = {
            file: processedFile,
            preview: previewUrl,
            url: null, progress: 0, uploaded: false,
            id: Math.random().toString(36).slice(2),
            isVideo: croppingState.isVideo,
            duration: croppingState.duration,
            trimRange: croppingState.isVideo ? trimRange : null
        };

        const updatedProcessed = [...croppingState.allProcessed, newImgObj];

        if (croppingState.pendingFiles.length > 0) {
            const nextFile = croppingState.pendingFiles[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCroppingState(prev => ({
                    ...prev,
                    currentSource: reader.result,
                    pendingFiles: prev.pendingFiles.slice(1),
                    allProcessed: updatedProcessed,
                    originalFile: nextFile
                }));
                setCrop({ x: 0, y: 0 });
                setZoom(1);
            };
            reader.readAsDataURL(nextFile);
        } else {
            if (croppingState.isVideo) {
                setVideo({ ...newImgObj, preview: croppingState.currentSource });
                setImages([]);
            } else {
                setImages(updatedProcessed);
                setVideo(null);
            }
            setCroppingState(prev => ({ ...prev, active: false, allProcessed: updatedProcessed }));
            // Give state a moment to settle before changing step to ensure URL stability
            setTimeout(() => setStep(STEPS.FINALIZE), 50);
        }
    };

    const uploadAllImages = async () => {
        const pending = images.filter(img => !img.uploaded);
        const uploaded = [...images];
        let hasError = false;
        await Promise.all(pending.map(async (img) => {
            const idx = uploaded.findIndex(i => i.id === img.id);
            try {
                const result = await uploadToCloudinary(img.file, (p) => setImages(prev => prev.map(i => i.id === img.id ? { ...i, progress: p } : i)));
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

    const uploadVideoIfNeeded = async () => {
        if (!video) return null;
        try {
            const options = {};
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
        setIsPosting(true);
        let uploadToast = null;
        try {
            let imageURLs = [];
            if (images.length > 0) imageURLs = await uploadAllImages();
            let voiceNoteUrl = null, voiceNoteDuration = null;
            if (voiceBlob) {
                const voiceFile = new File([voiceBlob], 'voice.webm', { type: voiceBlob.type || 'audio/webm' });
                const result = await uploadVideoToCloudinary(voiceFile);
                voiceNoteUrl = typeof result === 'string' ? result : result?.url;
                voiceNoteDuration = recordingDuration;
            }
            let videoUrl = null, videoDuration = null, videoThumbnail = null;
            if (video) {
                const v = await uploadVideoIfNeeded();
                if (!v) { setIsPosting(false); return; }
                videoUrl = v.url; videoDuration = v.duration; videoThumbnail = v.thumbnailUrl;
            }
            let mood = null;
            try {
                uploadToast = toast.loading("Sharing...");
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
                videoURL: videoUrl, videoDuration, videoThumbnail, mood,
                isAiGenerated: usedAiForThisPost,
                poll: openFeaturePanel === 'poll' && pollOptions.filter(o => o.trim()).length >= 2 ? {
                    options: pollOptions.filter(o => o.trim()).map(o => ({ text: o, votes: [] })),
                    correctOptionIndex: isQuiz ? correctOptionIndex : null
                } : null,
                groupId: selectedGroupId,
                isCollaborative,
            };

            const response = await createPostMutation.mutateAsync(postData);
            if (response?.data?._id) {
                addSocketPost(response.data);
                toast.success("Post created successfully!", { id: uploadToast });
                handleCloseInternal(true);
            } else {
                toast.error("Failed to create post", { id: uploadToast });
            }
        } catch (error) {
            toast.error(error?.message || "Error occurred", { id: uploadToast });
        } finally { setIsPosting(false); }
    };

    const renderHeader = () => {
        let title = "Create new post";
        if (step === STEPS.PREVIEW) title = "Crop";
        if (step === STEPS.FINALIZE) title = "Create new post";

        return (
            <div className="flex items-center justify-between px-2 py-2 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                    {step !== STEPS.SELECT && (
                        <button onClick={() => setStep(step === STEPS.PREVIEW ? STEPS.SELECT : STEPS.PREVIEW)} className="text-[var(--text-main)] text-xl p-1 hover:bg-[var(--surface-2)] rounded-full transition">
                            <i className="pi pi-arrow-left"></i>
                        </button>
                    )}
                </div>

                <h2 className="text-sm font-bold text-[var(--text-main)] m-0">{title}</h2>

                <button
                    onClick={() => step === STEPS.PREVIEW ? handleApplyCrop() : handleSubmit()}
                    disabled={isPosting}
                    className="text-[#6366f1] text-sm font-bold hover:text-[#818cf8] transition disabled:opacity-50 flex items-center gap-2"
                >
                    {isPosting && step !== STEPS.PREVIEW && <i className="pi pi-spinner pi-spin text-xs"></i>}
                    {step === STEPS.SELECT ? "" : (step === STEPS.PREVIEW ? (croppingState.pendingFiles.length > 0 ? "Next Image" : "Next") : (isPosting ? "Posting..." : "Post"))}
                </button>
            </div>
        );
    };

    const renderSelect = () => (
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px] text-center gap-6">
            <div className="text-6xl text-[var(--text-sub)] opacity-40">
                <i className="pi pi-images"></i>
            </div>
            <h3 className="text-xl text-[var(--text-main)] font-medium">select photos and videos</h3>
            <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#6366f1] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#4f46e5] transition"
            >
                Select Any Media
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} hidden />
        </div>
    );

    const renderPreview = () => (
        <div className="bg-black flex flex-col w-full h-[600px] relative group overflow-hidden">
            <div className="flex-1 relative bg-[#0a0a0a]">
                <Cropper
                    key={croppingState.currentSource}
                    image={!croppingState.isVideo ? croppingState.currentSource : undefined}
                    video={croppingState.isVideo ? croppingState.currentSource : undefined}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    onCropChange={setCrop}
                    onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    onZoomChange={setZoom}
                    showGrid={true}
                    onMediaLoaded={() => setIsCropperLoaded(true)}
                    classes={{ 
                        containerClassName: 'bg-[#0a0a0a]',
                        cropAreaClassName: 'border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]'
                    }}
                />
                {!isCropperLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
                        <i className="pi pi-spin pi-spinner text-3xl text-[#6366f1]"></i>
                    </div>
                )}
            </div>

            <div className="bg-[#121212] p-4 border-t border-[var(--border-color)]">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {ASPECT_PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    onClick={() => setAspect(p.value)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${aspect === p.value ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)] hover:border-[var(--text-sub)]'}`}
                                >
                                    <i className={`pi ${p.icon} text-[8px]`}></i>
                                    {p.label}
                                </button>
                            ))}
                            <button
                                onClick={() => { setAspect(null); setZoom(1); setCrop({ x: 0, y: 0 }); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${aspect === null ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)] hover:border-[var(--text-sub)]'}`}
                            >
                                Original
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <i className="pi pi-minus text-[8px] text-[var(--text-sub)]"></i>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="w-24 h-1 bg-[var(--surface-2)] rounded-lg appearance-none cursor-pointer accent-[#6366f1]"
                            />
                            <i className="pi pi-plus text-[8px] text-[var(--text-sub)]"></i>
                        </div>
                    </div>

                    {croppingState.isVideo && (
                        <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider">Video Trim (Max 60s)</span>
                                <span className="text-[10px] text-[var(--text-sub)] font-mono bg-white/5 px-2 py-0.5 rounded">
                                    {Math.floor(trimRange[0])}s - {Math.floor(trimRange[1])}s ({Math.floor(trimRange[1] - trimRange[0])}s)
                                </span>
                            </div>
                            <div className="px-2">
                                <Slider 
                                    value={trimRange} 
                                    onChange={(e) => {
                                        const newRange = e.value;
                                        const start = newRange[0];
                                        const end = newRange[1];
                                        
                                        // Enforce 60s limit
                                        if (end - start > 60) {
                                            // If they moved the start handle
                                            if (start !== trimRange[0]) {
                                                setTrimRange([start, Math.min(croppingState.duration, start + 60)]);
                                            } else {
                                                // They moved the end handle
                                                setTrimRange([Math.max(0, end - 60), end]);
                                            }
                                        } else {
                                            setTrimRange(newRange);
                                        }
                                    }} 
                                    range 
                                    min={0} 
                                    max={croppingState.duration || 60} 
                                    step={0.1}
                                    className="w-full"
                                />
                            </div>
                            <p className="text-[9px] text-[var(--text-sub)] opacity-60 italic text-center">
                                Tip: The selected segment will be shared. Max 60 seconds allowed.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderFinalize = () => (
        <div className="flex flex-col md:flex-row w-full min-h-[500px] h-[calc(90vh-45px)] max-h-[600px]">
            {/* Left: Media Preview */}
            <div className="w-full md:w-[60%] bg-black flex flex-col items-center justify-center p-0 relative">
                <div className="flex-1 flex items-center justify-center w-full relative">
                    {video ? (
                        <video src={video.preview} autoPlay muted loop className="w-full h-full object-contain" />
                    ) : (
                        images.length > 0 && <img src={images[0]?.preview} key={images[0]?.preview} className="w-full h-full object-contain" alt="preview" />
                    )}
                </div>
                {images.length > 1 && (
                    <div className="w-full p-2 bg-black/40 backdrop-blur-md flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar border-t border-white/10">
                        {images.map((img, idx) => (
                            <div key={img.id} className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${idx === 0 ? 'border-[#6366f1]' : 'border-transparent opacity-60'}`}>
                                <img src={img.preview} className="w-full h-full object-cover" alt="" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: metadata & controls */}
            <div className="w-full md:w-[40%] flex flex-col bg-[var(--surface-1)] border-l border-[var(--border-color)] overflow-y-auto custom-scrollbar">
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
                        <button onClick={handleGetLocation} className="flex items-center justify-between py-3 px-1 border-b border-[var(--border-color)]/50 hover:bg-[var(--surface-2)] transition-colors group">
                            <span className="text-sm text-[var(--text-main)] font-medium flex items-center gap-2">
                                {location.name ? <i className="pi pi-map-marker text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i> : <i className="pi pi-map-marker text-[var(--text-sub)] group-hover:text-[#6366f1] transition-colors"></i>}
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

                        <div className="border-b border-[var(--border-color)]/50">
                            <button onClick={() => togglePanel('advanced')} className="flex items-center justify-between w-full py-3 px-1 hover:bg-[var(--surface-2)] transition-colors group">
                                <span className="text-sm text-[var(--text-main)] font-medium">Advanced Settings</span>
                                <i className={`pi pi-chevron-${openFeaturePanel === 'advanced' ? 'up' : 'down'} text-[10px] opacity-30 group-hover:opacity-100`}></i>
                            </button>
                            {openFeaturePanel === 'advanced' && (
                                <div className="p-3 bg-[var(--surface-2)]/50 flex flex-col gap-4 animate-in slide-in-from-top-2">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-[var(--text-main)]">Post Anonymously</span>
                                            <span className="text-[10px] text-[var(--text-sub)]">Hide your identity</span>
                                        </div>
                                        <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] accent-[#6366f1] transition-all" />
                                    </label>
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

                        <div>
                            <button onClick={() => togglePanel('ai')} className="flex items-center justify-between w-full py-3 px-1 hover:bg-[var(--surface-2)] transition-colors group text-[#6366f1]">
                                <span className="text-sm font-bold flex items-center gap-2">
                                    <span className="animate-pulse">✨</span> AI Magic Tools
                                </span>
                                <i className={`pi pi-chevron-${openFeaturePanel === 'ai' ? 'up' : 'down'} text-[10px] opacity-30 group-hover:opacity-100`}></i>
                            </button>
                            {openFeaturePanel === 'ai' && (
                                <div className=" flex flex-col gap-3 m-1 animate-in zoom-in-95">
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
                    </div>
                </div>
            </div>
        </div>
    );

    return (
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
                    {step === STEPS.PREVIEW && renderPreview()}
                    {step === STEPS.FINALIZE && renderFinalize()}
                </div>
            </div>
        </Dialog>
    );
};

export default NewPost;
