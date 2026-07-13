import React, { useState, useRef, useEffect } from "react";
import dbService from '../../utils/indexedDb';
import { useGroups } from '../../hooks/queries/useAuthQueries';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import { useCreatePost } from '../../hooks/queries/usePostQueries';
import toast from '../../utils/toast.js';
import ImageCropper from './ui/ImageCropper';
import { encryptFile, generateSymmetricKey, exportSymmetricKey } from "../../utils/cryptoUtils";
import useToastStore from '../../store/zustand/useToastStore';
import { appChannel } from "../../utils/broadcast";

import { uploadMedia, uploadVideo, generateVideoThumbnail, validateImageFile, validateImageType, validateVideoFile, validateVideoType } from '../../utils/cloudinary';
import { useSystemFlags } from "../../hooks/queries/useMiscQueries";


import { Dialog } from 'primereact/dialog';
import MentionSuggestions from './ui/MentionSuggestions';

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
    const beforeInputRef = useRef(null);
    const afterInputRef = useRef(null);

    const [step, setStep] = useState(STEPS.SELECT);
    const [formData, setFormData] = useState({ caption: "", category: "Default" });
    const [images, setImages] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [activeMediaType, setActiveMediaType] = useState('image'); // 'video' | 'image'
    const [video, setVideo] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [openFeaturePanel, setOpenFeaturePanel] = useState(null);

    // Goals linking state
    const [userGoals, setUserGoals] = useState([]);
    const [selectedGoalId, setSelectedGoalId] = useState(null);



    // Before / After State
    const [isBeforeAfter, setIsBeforeAfter] = useState(false);
    const [beforeAfterType, setBeforeAfterType] = useState('image'); // 'image' | 'code' | 'text'
    const [beforeImage, setBeforeImage] = useState(null); // { preview, file }
    const [afterImage, setAfterImage] = useState(null); // { preview, file }
    const [beforeLabel, setBeforeLabel] = useState('Before');
    const [afterLabel, setAfterLabel] = useState('After');
    const [beforeText, setBeforeText] = useState('');
    const [afterText, setAfterText] = useState('');

    // Location & music
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [, setLoadingLocation] = useState(false);
    const [music] = useState({ title: '', artist: '' });

    // Features
    const [visibility, setVisibility] = useState('public');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [expiresIn, setExpiresIn] = useState('');
    const [unlocksAt, setUnlocksAt] = useState('');
    const [isCollaborative, setIsCollaborative] = useState(false);
    const [collaborators, setCollaborators] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Tagged users (Direct Mentions list)
    const [taggedUsers, setTaggedUsers] = useState([]);
    const [tagSearchTerm, setTagSearchTerm] = useState("");
    const [tagSearchResults, setTagSearchResults] = useState([]);
    const [isSearchingTags, setIsSearchingTags] = useState(false);

    // Voice note
    const [voiceBlob] = useState(null);
    const [recordingDuration] = useState(0);

    // AI
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [usedAiForThisPost, setUsedAiForThisPost] = useState(false);
    const [aiLimits, setAiLimits] = useState({ text: 2, image: 2 });
    const [suggestedCaptions, setSuggestedCaptions] = useState([]);

    // Polls
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [isQuiz] = useState(false);
    const [correctOptionIndex] = useState(null);

    // Groups
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const { data: groups = [] } = useGroups();
    const [cursorPosition, setCursorPosition] = useState(0);

    // Feedback request state
    const [isFeedbackRequest, setIsFeedbackRequest] = useState(false);
    const [feedbackCategory, setFeedbackCategory] = useState('general'); // 'design' | 'code' | 'writing' | 'general'

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
    const [drafts, setDrafts] = useState([]);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showDraftsListModal, setShowDraftsListModal] = useState(false);

    useEffect(() => {
        if (visible && loggeduser?._id) {
            dbService.getDraft(`drafts_${loggeduser._id}`).then(async (saved) => {
                let list = Array.isArray(saved) ? saved : [];
                // Check for legacy single draft
                const legacy = await dbService.getDraft(`draft_${loggeduser._id}`);
                if (legacy) {
                    const newDraft = {
                        id: 'draft_' + Date.now(),
                        updatedAt: Date.now(),
                        ...legacy
                    };
                    list = [newDraft, ...list].slice(0, 3);
                    await dbService.setDraft(`drafts_${loggeduser._id}`, list);
                    await dbService.removeDraft(`draft_${loggeduser._id}`);
                }
                setDrafts(list);
            });
        }
    }, [visible, loggeduser?._id]);

    const saveDraft = async (manual = false) => {
        if (!loggeduser?._id) return;
        if (!manual && !activeDraftId) return;

        const isPostEmpty = images.length === 0 && !video && !formData.caption.trim() && !beforeImage && !afterImage && !beforeText.trim() && !afterText.trim();
        if (isPostEmpty) return;

        const draftData = {
            formData,
            beforeLabel,
            afterLabel,
            beforeText,
            afterText,
            visibility,
            isAnonymous,
            selectedGoalId,
            isBeforeAfter,
            beforeAfterType,
            images: images.map(img => ({ id: img.id, file: img.file, preview: img.preview })),
            video: video ? { file: video.file, preview: video.preview } : null,
            beforeImage: beforeImage ? { file: beforeImage.file, preview: beforeImage.preview } : null,
            afterImage: afterImage ? { file: afterImage.file, preview: afterImage.preview } : null,
            location,
            isCollaborative,
            collaborators
        };

        try {
            const saved = await dbService.getDraft(`drafts_${loggeduser._id}`);
            let list = Array.isArray(saved) ? saved : [];

            let draftId = activeDraftId;
            if (draftId) {
                // Update existing draft
                list = list.map(d => d.id === draftId ? { ...d, updatedAt: Date.now(), ...draftData } : d);
            } else {
                // Create new draft
                draftId = 'draft_' + Date.now();
                const newDraft = {
                    id: draftId,
                    updatedAt: Date.now(),
                    ...draftData
                };
                list = [newDraft, ...list].slice(0, 3);
                setActiveDraftId(draftId);
            }

            await dbService.setDraft(`drafts_${loggeduser._id}`, list);
            setDrafts(list);

            appChannel.postMessage({
                type: "DRAFT_SYNC",
                draftId,
                content: draftData.formData?.caption || '',
                updatedAt: Date.now()
            });

            if (manual) {
                useToastStore.getState().show({ message: "Post saved in draft!", type: "success" });
            }
        } catch (e) {
            console.error("Failed to save draft:", e);
        }
    };

    useEffect(() => {
        if (!loggeduser?._id || !visible) return;
        const timer = setTimeout(() => {
            saveDraft(false);
        }, 1500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        loggeduser?._id,
        visible,
        formData,
        beforeLabel,
        afterLabel,
        beforeText,
        afterText,
        visibility,
        isAnonymous,
        selectedGoalId,
        isBeforeAfter,
        beforeAfterType,
        images,
        video,
        beforeImage,
        afterImage,
        location,
        isCollaborative,
        collaborators,
        activeDraftId
    ]);

    const restoreDraft = async (draft) => {
        if (!draft) return;
        try {
            setFormData(draft.formData || { caption: "", category: "Default" });
            setBeforeLabel(draft.beforeLabel || 'Before');
            setAfterLabel(draft.afterLabel || 'After');
            setBeforeText(draft.beforeText || '');
            setAfterText(draft.afterText || '');
            setVisibility(draft.visibility || 'public');
            setIsAnonymous(draft.isAnonymous || false);
            setSelectedGoalId(draft.selectedGoalId || null);
            setIsBeforeAfter(draft.isBeforeAfter || false);
            setBeforeAfterType(draft.beforeAfterType || 'image');

            if (draft.images) {
                setImages(draft.images.map((img, idx) => ({
                    ...img,
                    id: img.id || `restored_${idx}_${Date.now()}`,
                    preview: img.file ? URL.createObjectURL(img.file) : img.preview
                })));
            } else {
                setImages([]);
            }

            if (draft.video) {
                setVideo({
                    ...draft.video,
                    preview: draft.video.file ? URL.createObjectURL(draft.video.file) : draft.video.preview
                });
            } else {
                setVideo(null);
            }

            if (draft.beforeImage) {
                setBeforeImage({
                    ...draft.beforeImage,
                    preview: draft.beforeImage.file ? URL.createObjectURL(draft.beforeImage.file) : draft.beforeImage.preview
                });
            } else {
                setBeforeImage(null);
            }

            if (draft.afterImage) {
                setAfterImage({
                    ...draft.afterImage,
                    preview: draft.afterImage.file ? URL.createObjectURL(draft.afterImage.file) : draft.afterImage.preview
                });
            } else {
                setAfterImage(null);
            }

            setLocation(draft.location || { name: '', lat: null, lng: null });
            setIsCollaborative(draft.isCollaborative || false);
            setCollaborators(draft.collaborators || []);
            setStep(STEPS.FINALIZE);
            setActiveDraftId(draft.id);
            useToastStore.getState().show({ message: "Draft restored!", type: "success" });
        } catch (e) {
            console.error("Failed to restore draft:", e);
        }
    };

    const deleteDraft = async (draftId) => {
        try {
            const saved = await dbService.getDraft(`drafts_${loggeduser._id}`);
            let list = Array.isArray(saved) ? saved : [];
            list = list.filter(d => d.id !== draftId);
            await dbService.setDraft(`drafts_${loggeduser._id}`, list);
            setDrafts(list);
            if (activeDraftId === draftId) {
                setActiveDraftId(null);
            }
            useToastStore.getState().show({ message: "Draft deleted.", type: "success" });
        } catch (e) {
            console.error("Failed to delete draft:", e);
        }
    };

    useEffect(() => {
        if (visible && loggeduser?._id) {
            api.get(`/api/goal/user/${loggeduser._id}`)
                .then(res => {
                    setUserGoals((res.data || []).filter(g => g.status === 'active'));
                })
                .catch(err => console.error("Failed to fetch goals:", err));
        }
    }, [visible, loggeduser?._id]);

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
        setTaggedUsers([]);
        setTagSearchTerm("");
        setTagSearchResults([]);
        setIsSearchingTags(false);
        setAiPrompt("");
        setSuggestedCaptions([]);
        setPollOptions(['', '']);
        setVisibility('public');
        setIsAnonymous(false);
        setExpiresIn('');
        setUnlocksAt('');
        setSelectedGroupId(null);
        setIsBeforeAfter(false);
        setBeforeAfterType('image');
        setBeforeImage(null);
        setAfterImage(null);
        setBeforeLabel('Before');
        setAfterLabel('After');
        setBeforeText('');
        setAfterText('');
        setIsFeedbackRequest(false);
        setFeedbackCategory('general');
        setSelectedGoalId(null);
        setActiveDraftId(null);
    };

    const handleCloseInternal = (force = false) => {
        const hasContent = images.length > 0 || video || formData.caption.trim() || beforeImage || afterImage || beforeText.trim() || afterText.trim();
        if (!force && hasContent) {
            setShowCloseConfirm(true);
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
        setLoadingLocation(true);
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            setLoadingLocation(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                    const data = await res.json();
                    const name = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
                    setLocation({ name, lat, lng });
                    toast.success(`📍 ${name}`);
                } catch {
                    setLocation({ name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng });
                }
                setLoadingLocation(false);
            },
            (err) => {
                toast.error('Could not get location. Please enable location permissions.');
                console.error('Geolocation error:', err);
                setLoadingLocation(false);
            }
        );
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
        if (!aiPrompt.trim()) {
            if (images.length > 0) {
                setIsGeneratingAi(true);
                const toastId = toast.loading("Analyzing image to generate captions...");
                try {
                    let targetUrl = images[activeImageIndex]?.url;
                    if (!targetUrl) {
                        // Upload image first
                        const uploadRes = await uploadMedia(images[activeImageIndex].file, null, { folder: 'ai-temp' });
                        targetUrl = uploadRes.url;
                        setImages(prev => prev.map((img, i) => i === activeImageIndex ? { ...img, url: targetUrl, uploaded: true } : img));
                    }

                    const res = await api.post(`/api/ai/caption`, { imageUrl: targetUrl });
                    if (res.data?.captions && res.data.captions.length > 0) {
                        setSuggestedCaptions(res.data.captions);
                        // Populate first caption as default
                        setFormData(p => ({ ...p, caption: res.data.captions[0] }));
                        setUsedAiForThisPost(true);
                        toast.success("✨ Image-based captions generated!", { id: toastId });
                    } else {
                        toast.error("Failed to analyze image content", { id: toastId });
                    }
                } catch (err) {
                    toast.error(err.response?.data?.error || err.message || 'Failed to analyze image', { id: toastId });
                } finally {
                    setIsGeneratingAi(false);
                }
            } else {
                toast.error('Enter an AI prompt or upload an image first');
            }
            return;
        }

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

    const handleBeforeAfterFileSelect = (e, target) => {
        const file = e.target.files[0];
        if (!file) return;
        const typeErr = validateImageType(file);
        if (typeErr) { toast.error(typeErr); return; }
        const sizeWarn = validateImageFile(file);
        if (sizeWarn) toast.error(sizeWarn);
        const preview = URL.createObjectURL(file);
        if (target === 'before') {
            setBeforeImage({ file, preview });
        } else {
            setAfterImage({ file, preview });
        }
        e.target.value = '';
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
            // Show size warning but still proceed — uploadMedia falls back to Drive
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
                const result = await uploadMedia(img.file, (p) => setImages(prev => prev.map(i => i.id === img.id ? { ...i, progress: p } : i)), { folder: 'posts' });
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
            const result = await uploadVideo(video.file, (p) => setVideo(v => v && v.id === video.id ? { ...v, progress: p } : v), options);
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
        if (isBeforeAfter) {
            if (beforeAfterType === 'image') {
                if (!beforeImage || !afterImage) { toast.error("Please upload both Before and After images!"); return; }
            } else {
                if (!beforeText.trim() || !afterText.trim()) { toast.error("Please write both Before and After contents!"); return; }
            }
        } else {
            if (!formData.caption.trim() && images.length === 0 && !video) { toast.error("Please add a caption, image, or video!"); return; }
        }

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
        const tags = [...taggedUsers];
        const aiGen = usedAiForThisPost;
        const poll = openFeaturePanel === 'poll' && pollOptions.filter(o => o.trim()).length >= 2 ? {
            options: pollOptions.filter(o => o.trim()).map(o => ({ text: o, votes: [] })),
            correctOptionIndex: isQuiz ? correctOptionIndex : null
        } : null;
        const grp = selectedGroupId;
        const isCollab = isCollaborative;
        const beforeImageToUpload = beforeImage;
        const afterImageToUpload = afterImage;

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

                let beforeUrl = null;
                let afterUrl = null;
                let beforeImageKey = null;
                let beforeImageIv = null;
                let afterImageKey = null;
                let afterImageIv = null;

                if (isBeforeAfter && beforeAfterType === 'image') {
                    // Encrypt Before Image
                    const beforeKey = await generateSymmetricKey();
                    const { ciphertext: beforeCt, iv: beforeIv } = await encryptFile(beforeImageToUpload.file, beforeKey);
                    const beforeEncryptedBlob = new Blob([beforeCt], { type: 'application/octet-stream' });
                    const beforeFileEnc = new File([beforeEncryptedBlob], beforeImageToUpload.file.name || 'before.jpg', { type: 'application/octet-stream' });
                    const beforeRes = await uploadMedia(beforeFileEnc, null, { folder: folderPath, resourceType: 'raw' });
                    beforeUrl = typeof beforeRes === 'string' ? beforeRes : beforeRes?.url;
                    beforeImageKey = await exportSymmetricKey(beforeKey);
                    beforeImageIv = beforeIv;

                    // Encrypt After Image
                    const afterKey = await generateSymmetricKey();
                    const { ciphertext: afterCt, iv: afterIv } = await encryptFile(afterImageToUpload.file, afterKey);
                    const afterEncryptedBlob = new Blob([afterCt], { type: 'application/octet-stream' });
                    const afterFileEnc = new File([afterEncryptedBlob], afterImageToUpload.file.name || 'after.jpg', { type: 'application/octet-stream' });
                    const afterRes = await uploadMedia(afterFileEnc, null, { folder: folderPath, resourceType: 'raw' });
                    afterUrl = typeof afterRes === 'string' ? afterRes : afterRes?.url;
                    afterImageKey = await exportSymmetricKey(afterKey);
                    afterImageIv = afterIv;
                }

                let imageURLs = [];
                let mediaKeys = [];
                if (imagesToUpload.length > 0) {
                    const pending = imagesToUpload.filter(img => !img.uploaded);
                    const uploaded = [...imagesToUpload];

                    await Promise.all(pending.map(async (img) => {
                        const idx = uploaded.findIndex(i => i.id === img.id);
                        try {
                            const imgKey = await generateSymmetricKey();
                            const { ciphertext, iv } = await encryptFile(img.file, imgKey);
                            const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
                            const fileEnc = new File([encryptedBlob], img.file.name || 'image.jpg', { type: 'application/octet-stream' });

                            const result = await uploadMedia(fileEnc, null, { folder: folderPath, resourceType: 'raw' });
                            const url = typeof result === 'string' ? result : result?.url;
                            const keyJWK = await exportSymmetricKey(imgKey);
                            uploaded[idx] = { ...uploaded[idx], url, uploaded: true, key: keyJWK, iv };
                        } catch (err) {
                            console.error(`Failed to upload ${img.file?.name}`, err);
                            throw new Error(`Failed to upload ${img.file?.name || 'Image'}`);
                        }
                    }));
                    imageURLs = uploaded.filter(i => i.uploaded).map(i => i.url);
                    mediaKeys = uploaded.filter(i => i.uploaded).map(i => ({ key: i.key, iv: i.iv }));
                }

                let voiceNoteUrl = null, voiceNoteDuration = null, voiceNoteKey = null, voiceNoteIv = null;
                if (voiceBlobToUpload) {
                    const voiceKey = await generateSymmetricKey();
                    const arrayBuffer = await voiceBlobToUpload.arrayBuffer();
                    const { ciphertext, iv } = await encryptFile(new File([arrayBuffer], 'voice.webm'), voiceKey);
                    const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
                    const voiceFile = new File([encryptedBlob], 'voice.webm', { type: 'application/octet-stream' });

                    const result = await uploadVideo(voiceFile, null, { folder: folderPath, resourceType: 'raw' });
                    voiceNoteUrl = typeof result === 'string' ? result : result?.url;
                    voiceNoteDuration = recDuration;
                    voiceNoteKey = await exportSymmetricKey(voiceKey);
                    voiceNoteIv = iv;
                }

                let videoUrl = null, videoDuration = null, videoThumbnail = null, videoKey = null, videoIv = null;
                if (videoToUpload) {
                    // Generate thumbnail from the ORIGINAL file before encryption.
                    // After encryption the file is binary and can't be decoded as video.
                    let thumbnailUrl = null;
                    try {
                        const thumbFile = await generateVideoThumbnail(videoToUpload.file);
                        const thumbResult = await uploadMedia(thumbFile, null, { folder: folderPath });
                        thumbnailUrl = thumbResult?.url || null;
                    } catch (thumbErr) {
                        console.warn('[Video] Thumbnail generation/upload failed (non-critical):', thumbErr.message);
                    }

                    const vidKey = await generateSymmetricKey();
                    const { ciphertext, iv } = await encryptFile(videoToUpload.file, vidKey);
                    const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
                    const videoFile = new File([encryptedBlob], videoToUpload.file.name || 'video.mp4', { type: 'application/octet-stream' });

                    // Upload as 'raw' — the file is encrypted binary, not a playable video.
                    const options = { folder: folderPath, resourceType: 'raw' };
                    const result = await uploadMedia(videoFile, null, options);
                    videoUrl = typeof result === 'string' ? result : result?.url;
                    videoThumbnail = thumbnailUrl;
                    videoDuration = videoToUpload.trimRange ? (videoToUpload.trimRange[1] - videoToUpload.trimRange[0]) : videoToUpload.duration;
                    videoKey = await exportSymmetricKey(vidKey);
                    videoIv = iv;
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
                    mentionIds: tags.map(t => t._id),
                    voiceNoteUrl, voiceNoteDuration,
                    videoURL: videoUrl, videoDuration, videoThumbnail, mood,
                    isAiGenerated: aiGen,
                    poll, groupId: grp, isCollaborative: isCollab,
                    visibility,
                    isBeforeAfter,
                    beforeAfter: isBeforeAfter ? {
                        type: beforeAfterType,
                        beforeUrl,
                        afterUrl,
                        beforeLabel,
                        afterLabel,
                        beforeText: beforeAfterType !== 'image' ? beforeText : null,
                        afterText: beforeAfterType !== 'image' ? afterText : null
                    } : null,
                    isFeedbackRequest,
                    feedbackCategory: isFeedbackRequest ? feedbackCategory : null,
                    goalId: selectedGoalId,
                    // DRM Keys
                    mediaKeys,
                    videoKey,
                    videoIv,
                    voiceNoteKey,
                    voiceNoteIv,
                    beforeImageKey,
                    beforeImageIv,
                    afterImageKey,
                    afterImageIv
                };

                const response = await createPostMutation.mutateAsync(postData);
                if (response?.data?._id) {
                    addSocketPost(response.data);
                    dbService.removeDraft(`draft_${loggeduser._id}`);
                    toast.success("Post shared successfully!", { id: uploadToast });

                    // Broadcast post creation so feeds on other pages/tabs/components update
                    appChannel.postMessage({
                        type: "POST_CREATED",
                        post: response.data
                    });

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
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 min-h-[500px] text-center gap-8">
            <div className="text-5xl text-[var(--text-sub)] opacity-30">
                <i className="pi pi-images"></i>
            </div>
            <div className="flex flex-col gap-2">
                <h3 className="text-xl text-[var(--text-main)] font-medium m-0">Create new post</h3>
                <p className="text-xs text-[var(--text-sub)]">Share photos and videos with your friends</p>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-md ">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-[#4F46E5] text-white h-14 p-4 text-base rounded-xl font-semibold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-md shadow-indigo-500/15 active:scale-[0.98] transition-all duration-200"
                >
                    <i className="pi pi-upload text-sm"></i>
                    Upload Media
                </button>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => setStep(STEPS.FINALIZE)}
                        className="flex-1 h-14 bg-[var(--surface-2)] text-[var(--text-main)] px-4 py-3 rounded-xl font-semibold hover:bg-[var(--surface-3)] hover:border-indigo-400  transition flex items-center justify-center gap-2 border border-[var(--border-color)] transition-all duration-200"
                    >
                        <i className="pi pi-pencil text-sm"></i>
                        Text Post
                    </button>
                    {flags?.ai_features !== false && (
                        <button
                            onClick={() => setStep(STEPS.AI_PROMPT)}
                            className="flex-1 h-14 bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white px-4 py-3 rounded-xl font-semibold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-md shadow-indigo-500/15 transition-all duration-200"
                        >
                            <i className="pi pi-sparkles text-sm"></i>
                            AI Create
                        </button>
                    )}
                </div>

                <button
                    onClick={() => {
                        setIsBeforeAfter(true);
                        setBeforeAfterType('image');
                        setStep(STEPS.FINALIZE);
                    }}
                    className="flex-1 h-14 bg-gradient-to-tr from-[#F97316] to-[#FB923C] text-white px-4 py-3 rounded-xl font-semibold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all duration-200"
                >
                    <i className="pi pi-arrows-h text-sm"></i>
                    Before / After Post
                </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} hidden />
        </div>
    );

    const renderAiPrompt = () => (
        <div className="flex flex-col items-center p-0 h-full bg-[var(--surface-1)] overflow-y-auto custom-scrollbar">
            <div className="w-full flex flex-col bg-[var(--surface-1)] min-h-full">
                <div className="p-4 flex flex-col gap-3">
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
                                {suggestedCaptions.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-[var(--border-color)]/30 flex flex-col gap-2">
                                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Alternative Caption Options</span>
                                        <div className="flex flex-col gap-1.5">
                                            {suggestedCaptions.map((caption, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => setFormData(prev => ({ ...prev, caption }))}
                                                    className={`p-2 rounded-lg text-xs cursor-pointer transition-all border ${formData.caption === caption ? 'bg-indigo-500/10 border-indigo-500 text-[var(--text-main)] font-medium shadow-sm' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)]'}`}
                                                >
                                                    {caption}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <EmojiSelector onSelect={(emoji) => setAiPrompt(prev => prev + emoji)} />
                    </div>

                    {/* Post Settings */}
                    <div className="flex flex-col gap-0 mt-2">
                        {/* Horizontal Feature Icons Bar */}
                        <div className="flex flex-wrap gap-1 justify-between items-center py-2 px-1 border-t border-b border-[var(--border-color)] bg-[var(--surface-2)]/30 rounded-xl my-2">
                            {/* Community Icon */}
                            <button
                                type="button"
                                title="Share to Community"
                                onClick={() => togglePanel('community')}
                                className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'community' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                            >
                                <i className="pi pi-globe text-base mb-1"></i>
                                <span className="text-[10px] font-semibold truncate max-w-full">
                                    {selectedGroupId ? "Group" : "Community"}
                                </span>
                            </button>

                            {/* Visibility Icon */}
                            <button
                                type="button"
                                title="Visibility"
                                onClick={() => togglePanel('visibility')}
                                className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'visibility' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                            >
                                <i className="pi pi-eye text-base mb-1"></i>
                                <span className="text-[10px] font-semibold truncate max-w-full">
                                    {visibility === 'public' ? 'Public' : visibility === 'followers' ? 'Followers' : 'Friends'}
                                </span>
                            </button>

                            {/* Location Icon */}
                            <button
                                type="button"
                                title="Add Location"
                                onClick={() => togglePanel('location')}
                                className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'location' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                            >
                                <i className="pi pi-map-marker text-base mb-1"></i>
                                <span className="text-[10px] font-semibold truncate max-w-full text-center">
                                    {location.name ? "Location" : "Location"}
                                </span>
                            </button>

                            {/* Collaborators Icon */}
                            <button
                                type="button"
                                title="Add Collaborators"
                                onClick={() => togglePanel('collab')}
                                className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'collab' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                            >
                                <i className="pi pi-users text-base mb-1"></i>
                                <span className="text-[10px] font-semibold truncate max-w-full">
                                    {collaborators.length > 0 ? `Collab (${collaborators.length})` : "Collab"}
                                </span>
                            </button>

                            {/* Advanced Settings Icon */}
                            <button
                                type="button"
                                title="Advanced Settings"
                                onClick={() => togglePanel('advanced')}
                                className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'advanced' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                            >
                                <i className="pi pi-cog text-base mb-1"></i>
                                <span className="text-[10px] font-semibold truncate max-w-full">
                                    Settings
                                </span>
                            </button>
                        </div>

                        {/* Community Panel Detail */}
                        {openFeaturePanel === 'community' && (
                            <div className="py-3 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                <span className="text-xs font-bold text-[var(--text-main)]">Share to Community</span>
                                <select
                                    value={selectedGroupId || ""}
                                    onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                    className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1]"
                                >
                                    <option value="">🌍 General Feed</option>
                                    {groups && groups.map(g => (
                                        <option key={g._id} value={g._id}>👥 {g.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Visibility Panel Detail */}
                        {openFeaturePanel === 'visibility' && (
                            <div className="py-3 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                <span className="text-xs font-bold text-[var(--text-main)]">Post Visibility</span>
                                <select
                                    value={visibility}
                                    onChange={(e) => setVisibility(e.target.value)}
                                    className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1]"
                                >
                                    <option value="public">🌐 Public</option>
                                    <option value="followers">👥 Followers Only</option>
                                    <option value="close_friends">🟢 Close Friends</option>
                                </select>
                            </div>
                        )}

                        {/* Location Panel Detail */}
                        {openFeaturePanel === 'location' && (
                            <div className="py-3 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-[var(--text-main)]">Add Location</span>
                                    {location.name && (
                                        <button
                                            type="button"
                                            onClick={() => setLocation({ name: '', lat: null, lng: null })}
                                            className="text-[10px] text-red-500 hover:underline"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--text-main)] flex-1 truncate bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 min-h-[32px] flex items-center">
                                        {location.name ? `📍 ${location.name}` : "No location selected"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        className="bg-[#6366f1] text-white text-xs font-bold rounded-lg px-3 py-1.5 hover:brightness-110 transition active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
                                    >
                                        <i className="pi pi-map-marker"></i> Get Current
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Collaborators Detail */}
                        {openFeaturePanel === 'collab' && (
                            <div className="py-2 px-1 bg-[var(--surface-2)]/50 flex flex-col gap-1 animate-in slide-in-from-top-2 rounded-xl my-1">
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
                                                <button onClick={() => removeCollaborator(user._id)} className="hover:text-red-500 border-0 bg-transparent cursor-pointer">
                                                    <i className="pi pi-times text-[8px]"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Advanced Detail */}
                        {openFeaturePanel === 'advanced' && (
                            <div className="p-3 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-4 animate-in slide-in-from-top-2 my-1">
                                {flags?.anonymous_posts !== false && (
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-[var(--text-main)]">Post Anonymously</span>
                                            <span className="text-[10px] text-[var(--text-sub)]">Hide your identity</span>
                                        </div>
                                        <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] accent-[#6366f1] transition-all" />
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
        const hasMedia = isBeforeAfter ? true : (images.length > 0 || video);

        return (
            <div className={`flex flex-col md:flex-row w-full h-[calc(100vh-120px)] md:h-[calc(90vh-45px)] md:max-h-[600px] ${!hasMedia ? 'justify-center' : ''}`}>
                {/* Left: Media Preview */}
                {hasMedia && (
                    <div className="w-full h-[40vh] md:h-auto md:w-[60%] bg-black flex flex-col items-center justify-center p-2 relative flex-shrink-0 overflow-y-auto custom-scrollbar">
                        {isBeforeAfter ? (
                            <div className="w-full h-full flex flex-col gap-4 max-w-[500px] justify-center">
                                {/* Format Selector */}
                                <div className="flex bg-[var(--surface-3)] p-1 rounded-xl gap-1">
                                    {['image', 'code', 'text'].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setBeforeAfterType(t)}
                                            style={{ background: beforeAfterType === t ? '#6366f1' : 'transparent', color: beforeAfterType === t ? '#fff' : 'var(--text-sub)' }}
                                            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
                                        >
                                            {t === 'image' ? '📷 Image' : t === 'code' ? '💻 Code' : '📝 Text'}
                                        </button>
                                    ))}
                                </div>

                                {/* Inputs for Image Comparison */}
                                {beforeAfterType === 'image' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            {/* Before image upload */}
                                            <div
                                                onClick={() => beforeInputRef.current?.click()}
                                                style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', background: 'var(--surface-2)', aspectRatio: '1/1', position: 'relative', cursor: 'pointer' }}
                                                className="flex-1 flex flex-col items-center justify-center text-center p-2 overflow-hidden hover:brightness-110 transition"
                                            >
                                                {beforeImage ? (
                                                    <>
                                                        <img src={beforeImage.preview} alt="Before preview" className="w-full h-full object-cover absolute inset-0" />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setBeforeImage(null); }}
                                                            className="absolute top-1 right-1 bg-black/75 hover:bg-red-500 text-white border-0 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-[10px]"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">Upload Before</span>
                                                )}
                                            </div>

                                            {/* After image upload */}
                                            <div
                                                onClick={() => afterInputRef.current?.click()}
                                                style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', background: 'var(--surface-2)', aspectRatio: '1/1', position: 'relative', cursor: 'pointer' }}
                                                className="flex-1 flex flex-col items-center justify-center text-center p-2 overflow-hidden hover:brightness-110 transition"
                                            >
                                                {afterImage ? (
                                                    <>
                                                        <img src={afterImage.preview} alt="After preview" className="w-full h-full object-cover absolute inset-0" />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setAfterImage(null); }}
                                                            className="absolute top-1 right-1 bg-black/75 hover:bg-red-500 text-white border-0 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-[10px]"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-[var(--text-sub)]">Upload After</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Labels */}
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                placeholder="Before Label"
                                                value={beforeLabel}
                                                onChange={e => setBeforeLabel(e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="After Label"
                                                value={afterLabel}
                                                onChange={e => setAfterLabel(e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Inputs for Code Comparison */}
                                {beforeAfterType === 'code' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Old Code (Before)</span>
                                            <textarea
                                                rows={4}
                                                placeholder="Paste old/original code snippet here..."
                                                value={beforeText}
                                                onChange={e => setBeforeText(e.target.value)}
                                                style={{ fontFamily: 'monospace' }}
                                                className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-3 text-xs text-[var(--text-main)] outline-none resize-none"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase">New Code (After)</span>
                                            <textarea
                                                rows={4}
                                                placeholder="Paste refactored/new code snippet here..."
                                                value={afterText}
                                                onChange={e => setAfterText(e.target.value)}
                                                style={{ fontFamily: 'monospace' }}
                                                className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-3 text-xs text-[var(--text-main)] outline-none resize-none"
                                            />
                                        </div>
                                        {/* Labels */}
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                placeholder="Before Label"
                                                value={beforeLabel}
                                                onChange={e => setBeforeLabel(e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="After Label"
                                                value={afterLabel}
                                                onChange={e => setAfterLabel(e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Inputs for Text Comparison */}
                                {beforeAfterType === 'text' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Rough Draft / Version 1</span>
                                            <textarea
                                                rows={4}
                                                placeholder="Write old copy or original text here..."
                                                value={beforeText}
                                                onChange={e => setBeforeText(e.target.value)}
                                                className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-3 text-xs text-[var(--text-main)] outline-none resize-none"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Final Draft / Version 2</span>
                                            <textarea
                                                rows={4}
                                                placeholder="Write updated copy or polished text here..."
                                                value={afterText}
                                                onChange={e => setAfterText(e.target.value)}
                                                className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-3 text-xs text-[var(--text-main)] outline-none resize-none"
                                            />
                                        </div>
                                        {/* Labels */}
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                placeholder="Before Label"
                                                value={beforeLabel}
                                                onChange={e => setBeforeLabel(e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] outline-none"
                                            />
                                            <input
                                                type="text"
                                                placeholder="After Label"
                                                value={afterLabel}
                                                onChange={e => setAfterLabel(e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <input ref={beforeInputRef} type="file" accept="image/*" onChange={(e) => handleBeforeAfterFileSelect(e, 'before')} hidden />
                                <input ref={afterInputRef} type="file" accept="image/*" onChange={(e) => handleBeforeAfterFileSelect(e, 'after')} hidden />
                            </div>
                        ) : (
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
                        )}
                        {/* Unified thumbnail strip — shown whenever there is a video, or 1+ images */}
                        {!isBeforeAfter && (video || images.length > 0) ? (
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
                    <div className="p-3 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <img src={loggeduser?.profile_picture} className="w-9 h-9 rounded-full object-cover border border-[var(--border-color)]" alt="" />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-[var(--text-main)]">{loggeduser?.fullname}</span>
                                <span className="text-[10px] text-[var(--text-sub)]">@{loggeduser?.username}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 relative">
                            <MentionSuggestions
                                text={formData.caption}
                                cursorPosition={cursorPosition}
                                onSelect={(val) => {
                                    setFormData(prev => ({ ...prev, caption: val }));
                                    if (captionRef.current) {
                                        captionRef.current.focus();
                                    }
                                }}
                            />
                            <textarea
                                ref={captionRef}
                                placeholder="Write a caption..."
                                value={formData.caption}
                                onChange={e => {
                                    handleChange(e);
                                    setCursorPosition(e.target.selectionStart);
                                }}
                                onKeyUp={e => setCursorPosition(e.target.selectionStart)}
                                onSelect={e => setCursorPosition(e.target.selectionStart)}
                                onClick={e => setCursorPosition(e.target.selectionStart)}
                                name="caption"
                                rows={3}
                                className="w-full border rounded-xl bg-transparent text-[var(--text-main)] text-sm resize-none outline-none border-none placeholder-[var(--text-sub)] leading-relaxed p-2"
                            />
                            <div className="flex justify-end px-2">
                                <span className="text-[10px] text-[var(--text-sub)] font-medium">{formData.caption.length}/2,200</span>
                            </div>
                            <EmojiSelector onSelect={handleEmojiSelect} />
                        </div>

                        <div className="flex flex-col gap-0">
                            {/* Horizontal Feature Icons Bar */}
                            <div className="flex flex-wrap gap-1 justify-between items-center py-2 px-1 bg-[var(--surface-2)]/30">
                                {/* Community Icon */}
                                <button
                                    type="button"
                                    title="Share to Community"
                                    onClick={() => togglePanel('community')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'community' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-globe text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full">
                                        {selectedGroupId ? "Group" : "Community"}
                                    </span>
                                </button>

                                {/* Goal Icon */}
                                {userGoals.length > 0 && (
                                    <button
                                        type="button"
                                        title="Link to Active Goal"
                                        onClick={() => togglePanel('goal')}
                                        className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'goal' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                    >
                                        <i className="pi pi-flag text-base mb-1"></i>
                                        <span className="text-[10px] font-semibold truncate max-w-full">
                                            Goal
                                        </span>
                                    </button>
                                )}

                                {/* Visibility Icon */}
                                <button
                                    type="button"
                                    title="Visibility"
                                    onClick={() => togglePanel('visibility')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'visibility' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-eye text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full">
                                        {visibility === 'public' ? 'Public' : visibility === 'followers' ? 'Followers' : 'Friends'}
                                    </span>
                                </button>

                                {/* Location Icon */}
                                <button
                                    type="button"
                                    title="Add Location"
                                    onClick={() => togglePanel('location')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'location' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-map-marker text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full text-center">
                                        {location.name ? "Location" : "Location"}
                                    </span>
                                </button>

                                {/* Collaborators Icon */}
                                <button
                                    type="button"
                                    title="Add Collaborators"
                                    onClick={() => togglePanel('collab')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'collab' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-users text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full">
                                        {collaborators.length > 0 ? `Collab (${collaborators.length})` : "Collab"}
                                    </span>
                                </button>

                                {/* Tag People Icon */}
                                <button
                                    type="button"
                                    title="Tag People"
                                    onClick={() => togglePanel('tag')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'tag' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-user-plus text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full">
                                        {taggedUsers.length > 0 ? `Tag (${taggedUsers.length})` : "Tag"}
                                    </span>
                                </button>

                                {/* Feedback Settings Icon */}
                                <button
                                    type="button"
                                    title="Feedback Settings"
                                    onClick={() => togglePanel('feedback')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'feedback' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-comments text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full">
                                        {isFeedbackRequest ? "Feedback" : "Feedback"}
                                    </span>
                                </button>

                                {/* Advanced Settings Icon */}
                                <button
                                    type="button"
                                    title="Advanced Settings"
                                    onClick={() => togglePanel('advanced')}
                                    className={`flex-1 min-w-[70px] flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'advanced' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                                >
                                    <i className="pi pi-cog text-base mb-1"></i>
                                    <span className="text-[10px] font-semibold truncate max-w-full">
                                        Settings
                                    </span>
                                </button>

                                {/* AI Magic Tools Icon */}
                                {flags?.ai_features !== false && (
                                    <button
                                        type="button"
                                        title="AI Magic Tools"
                                        onClick={() => togglePanel('ai')}
                                        className={`flex-1 min-w-[70px] flex flex-col gap-1 items-center justify-center p-2 rounded-xl transition-all cursor-pointer border ${openFeaturePanel === 'ai' ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'border-transparent text-[#6366f1]/80 hover:bg-[var(--surface-2)] hover:text-[#6366f1]'}`}
                                    >
                                        <i className="pi pi-sparkles text-sm"></i>
                                        <span className="text-[12px] font-bold truncate max-w-full">
                                            AI Magic
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* Community Panel Detail */}
                            {openFeaturePanel === 'community' && (
                                <div className="py-2 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                    <span className="text-xs font-bold text-[var(--text-main)]">Share to Community</span>
                                    <select
                                        value={selectedGroupId || ""}
                                        onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                        className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1]"
                                    >
                                        <option value="">🌍 General Feed</option>
                                        {groups && groups.map(g => (
                                            <option key={g._id} value={g._id}>👥 {g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Goal Panel Detail */}
                            {openFeaturePanel === 'goal' && userGoals.length > 0 && (
                                <div className="py-3 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                    <span className="text-xs font-bold text-[var(--text-main)]">Link to Active Goal</span>
                                    <select
                                        value={selectedGoalId || ""}
                                        onChange={(e) => setSelectedGoalId(e.target.value || null)}
                                        className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1]"
                                    >
                                        <option value="">🎯 None</option>
                                        {userGoals.map(g => (
                                            <option key={g._id} value={g._id}>🏁 {g.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Visibility Panel Detail */}
                            {openFeaturePanel === 'visibility' && (
                                <div className="py-3 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                    <span className="text-xs font-bold text-[var(--text-main)]">Post Visibility</span>
                                    <select
                                        value={visibility}
                                        onChange={(e) => setVisibility(e.target.value)}
                                        className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-main)] outline-none cursor-pointer focus:border-[#6366f1]"
                                    >
                                        <option value="public">🌐 Public</option>
                                        <option value="followers">👥 Followers Only</option>
                                        <option value="close_friends">🟢 Close Friends</option>
                                    </select>
                                </div>
                            )}

                            {/* Location Panel Detail */}
                            {openFeaturePanel === 'location' && (
                                <div className="py-3 px-2 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-2 animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[var(--text-main)]">Add Location</span>
                                        {location.name && (
                                            <button
                                                type="button"
                                                onClick={() => setLocation({ name: '', lat: null, lng: null })}
                                                className="text-[10px] text-red-500 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--text-main)] flex-1 truncate bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 min-h-[32px] flex items-center">
                                            {location.name ? `${location.name}` : "No location selected"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className="bg-[#6366f1] text-white text-xs font-bold rounded-lg px-3 py-1.5 hover:brightness-110 transition active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
                                        >
                                            <i className="pi pi-map-marker"></i> Current
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Collaborators Detail */}
                            {openFeaturePanel === 'collab' && (
                                <div className="py-2 px-1 bg-[var(--surface-2)]/50 flex flex-col gap-1 animate-in slide-in-from-top-2 rounded-xl my-1">
                                    <div className="relative">
                                        <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] text-[10px]"></i>
                                        <input
                                            type="text"
                                            placeholder="Search users to collab..."
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
                                                    <button onClick={() => removeCollaborator(user._id)} className="hover:text-red-500 transition-colors border-0 bg-transparent cursor-pointer">
                                                        <i className="pi pi-times text-[8px]"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tag People Detail */}
                            {openFeaturePanel === 'tag' && (
                                <div className="py-2 px-1 bg-[var(--surface-2)]/50 flex flex-col gap-1 animate-in slide-in-from-top-2 rounded-xl my-1">
                                    <div className="relative">
                                        <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] text-[10px]"></i>
                                        <input
                                            type="text"
                                            placeholder="Search users to tag..."
                                            value={tagSearchTerm}
                                            onChange={(e) => handleSearchTags(e.target.value)}
                                            className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl py-2 pl-8 pr-3 text-[11px] text-[var(--text-main)] outline-none focus:border-[#6366f1]"
                                        />
                                        {isSearchingTags && <i className="pi pi-spin pi-spinner absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6366f1]"></i>}
                                    </div>

                                    {tagSearchResults.length > 0 && (
                                        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar bg-[var(--surface-1)] rounded-xl border border-[var(--border-color)] shadow-xl p-1">
                                            {tagSearchResults.map(user => (
                                                <div
                                                    key={user._id}
                                                    onClick={() => addTagUser(user)}
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

                                    {taggedUsers.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]/30">
                                            {taggedUsers.map(user => (
                                                <div key={user._id} className="flex items-center gap-1.5 bg-[var(--surface-1)] border border-[#6366f1]/30 pl-1 pr-2 py-1 rounded-full animate-in zoom-in-95">
                                                    <img src={user.profile_picture} className="w-5 h-5 rounded-full object-cover" alt="" />
                                                    <span className="text-[10px] font-medium text-[var(--text-main)]">{user.username}</span>
                                                    <button onClick={() => removeTagUser(user._id)} className="hover:text-red-500 transition-colors border-0 bg-transparent cursor-pointer">
                                                        <i className="pi pi-times text-[8px]"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Feedback Detail */}
                            {openFeaturePanel === 'feedback' && (
                                <div className="p-3 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-3 animate-in slide-in-from-top-2 my-1">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-[var(--text-main)]">Request Structured Feedback</span>
                                            <span className="text-[10px] text-[var(--text-sub)]">Require critiques instead of likes</span>
                                        </div>
                                        <input type="checkbox" checked={isFeedbackRequest} onChange={e => setIsFeedbackRequest(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] accent-[#6366f1] transition-all" />
                                    </label>
                                    {isFeedbackRequest && (
                                        <div className="flex flex-col gap-2 pt-1">
                                            <span className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider opacity-60">Critique Category</span>
                                            <select value={feedbackCategory} onChange={e => setFeedbackCategory(e.target.value)} className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg p-2 text-xs text-[var(--text-main)] outline-none cursor-pointer">
                                                <option value="general">🗣️ General Feedback</option>
                                                <option value="design">🎨 Design Review</option>
                                                <option value="code">💻 Code Review</option>
                                                <option value="writing">📝 Writing Feedback</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Advanced Detail */}
                            {openFeaturePanel === 'advanced' && (
                                <div className="p-3 bg-[var(--surface-2)]/50 rounded-xl flex flex-col gap-4 animate-in slide-in-from-top-2 my-1">
                                    {flags?.anonymous_posts !== false && (
                                        <label className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-[var(--text-main)]">Post Anonymously</span>
                                                <span className="text-[10px] text-[var(--text-sub)]">Hide your identity</span>
                                            </div>
                                            <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] accent-[#6366f1] transition-all" />
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

                            {/* AI Detail */}
                            {openFeaturePanel === 'ai' && flags?.ai_features !== false && (
                                <div className="flex flex-col gap-3 m-1 animate-in zoom-in-95 bg-[var(--surface-2)]/50 p-3 rounded-xl">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[9px] font-bold text-[var(--text-sub)] uppercase">Remaining: {aiLimits.text} Text / {aiLimits.image} Image</span>
                                        {isGeneratingAi && <i className="pi pi-spin pi-spinner text-[10px] text-[#6366f1]"></i>}
                                    </div>
                                    <input type="text" placeholder="Generate content..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl p-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[#6366f1] shadow-inner" />
                                    <div className="flex gap-2">
                                        <button onClick={generateAiText} disabled={isGeneratingAi} className="flex-1 py-2 bg-[#6366f1] text-white text-[10px] font-bold rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-50 cursor-pointer">
                                            {isGeneratingAi ? <i className="pi pi-spin pi-spinner mr-1"></i> : null}
                                            Generate Text
                                        </button>
                                        <button onClick={generateAiImage} disabled={isGeneratingAi} className="flex-1 py-2 bg-purple-500 text-white text-[10px] font-bold rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-50 cursor-pointer">
                                            Generate Image
                                        </button>
                                    </div>
                                    {suggestedCaptions.length > 0 && (
                                        <div className="flex flex-col gap-2 p-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider px-1">AI Suggested Captions</span>
                                            {suggestedCaptions.map((caption, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => setFormData(prev => ({ ...prev, caption }))}
                                                    className={`p-2 rounded-lg text-xs cursor-pointer transition-all border ${formData.caption === caption ? 'bg-indigo-500/10 border-indigo-500 text-[var(--text-main)] font-medium shadow-sm' : 'border-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)]'}`}
                                                >
                                                    {caption}
                                                </div>
                                            ))}
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
                    {drafts.length > 0 && (
                        <div className="bg-[#6366f1]/10 border-b border-[#6366f1]/20 px-4 py-3 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
                            <span className="text-[var(--text-main)] font-semibold flex items-center gap-1.5">
                                📝 You have unsaved drafts ({drafts.length}/3).
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setShowDraftsListModal(true)} className="bg-[#6366f1] text-white border-0 px-3 py-1.5 rounded-lg font-bold cursor-pointer hover:bg-[#5356e2] transition-colors">
                                    View Drafts
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                        {step === STEPS.SELECT && renderSelect()}
                        {step === STEPS.AI_PROMPT && renderAiPrompt()}
                        {step === STEPS.FINALIZE && renderFinalize()}
                    </div>
                </div>
            </Dialog>

            <Dialog
                visible={showDraftsListModal}
                onHide={() => setShowDraftsListModal(false)}
                header="Saved Drafts"
                modal
                style={{ width: '90vw', maxWidth: '500px' }}
                contentStyle={{ padding: '20px', background: 'var(--surface-1)' }}
            >
                <div className="flex flex-col gap-3">
                    {drafts.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-[var(--surface-2)]">
                            <div className="flex flex-col gap-1 min-w-0 flex-1 mr-2">
                                <span className="font-semibold text-xs text-[var(--text-main)] truncate">
                                    {d.formData?.caption || d.beforeText || '(No text content)'}
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
                                    className="bg-[#6366f1] text-white border-0 px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer hover:bg-[#5356e2] transition"
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
            >
                <div className="flex flex-col gap-4">
                    <p className="text-[var(--text-sub)] text-sm m-0">
                        You have unsaved changes. Would you like to save this post as a draft to continue editing later, or discard it?
                    </p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={async () => {
                                await saveDraft(true);
                                resetState();
                                onHide();
                                setShowCloseConfirm(false);
                            }}
                            className="w-full bg-[#6366f1] text-white border-0 py-2.5 rounded-lg font-bold cursor-pointer hover:bg-[#5356e2] transition-colors text-sm"
                        >
                            Save to Draft
                        </button>
                        <button
                            onClick={() => {
                                resetState();
                                onHide();
                                setShowCloseConfirm(false);
                            }}
                            className="w-full bg-transparent border border-red-500/30 text-red-500 py-2.5 rounded-lg font-bold cursor-pointer hover:bg-red-500/10 transition-colors text-sm"
                        >
                            Discard Post
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
