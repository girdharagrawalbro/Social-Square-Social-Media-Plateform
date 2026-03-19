import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { addNewPost } from "../../store/slices/postsSlice";
import { uploadToCloudinary, validateImageFile } from "../../utils/cloudinary";

const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😅','🥳','❤️','🔥','✨','🎉','👍','🙌','💯','🌟','😭','🤣','😊','🥹','💪','🎵','📍','🌍','🍕','☕','🌸','🌈','👀','💬'];

const EmojiPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={ref} style={{
            position: 'absolute', top: '110%', left: 0,
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '12px', padding: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            display: 'flex', flexWrap: 'wrap', gap: '4px',
            width: '220px', zIndex: 100,
        }}>
            {EMOJIS.map(emoji => (
                <button key={emoji} type="button" onClick={() => onSelect(emoji)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                    onMouseEnter={e => e.target.style.background = '#f3f4f6'}
                    onMouseLeave={e => e.target.style.background = 'none'}
                >{emoji}</button>
            ))}
        </div>
    );
};

const NewPost = () => {
    const dispatch = useDispatch();
    const fileInputRef = useRef(null);
    const captionRef = useRef(null);
    const { loggeduser } = useSelector(state => state.users);

    const [formData, setFormData] = useState({ caption: "", category: "Default" });
    const [images, setImages] = useState([]);
    const [isPosting, setIsPosting] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showExtras, setShowExtras] = useState(false);
    const [location, setLocation] = useState({ name: '', lat: null, lng: null });
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [music, setMusic] = useState({ title: '', artist: '' });
    const [showMusicInput, setShowMusicInput] = useState(false);

    const handleChange = e => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEmojiSelect = (emoji) => {
        const input = captionRef.current;
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const newCaption = formData.caption.slice(0, start) + emoji + formData.caption.slice(end);
        setFormData(prev => ({ ...prev, caption: newCaption }));
        setTimeout(() => { input.focus(); input.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                const data = await res.json();
                const name = data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0] || 'Unknown';
                setLocation({ name, lat: latitude, lng: longitude });
                toast.success(`📍 ${name}`);
            } catch {
                setLocation({ name: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, lat: latitude, lng: longitude });
            }
            setLoadingLocation(false);
        }, () => { toast.error('Could not get location'); setLoadingLocation(false); });
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (images.length + files.length > 5) { toast.error('Maximum 5 images allowed'); return; }
        const newImages = [];
        for (const file of files) {
            const error = validateImageFile(file);
            if (error) { toast.error(error); continue; }
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
            const index = uploaded.findIndex(i => i.id === img.id);
            try {
                const url = await uploadToCloudinary(img.file, (progress) => {
                    setImages(prev => prev.map(i => i.id === img.id ? { ...i, progress } : i));
                });
                uploaded[index] = { ...uploaded[index], url, uploaded: true, progress: 100 };
            } catch {
                toast.error(`Failed to upload ${img.file.name}`);
                uploaded[index] = { ...uploaded[index], progress: 0 };
            }
        }));
        setImages(uploaded);
        return uploaded.filter(i => i.uploaded).map(i => i.url);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.caption.trim()) { toast.error("Caption cannot be empty!"); return; }
        setIsPosting(true);
        try {
            let imageURLs = [];
            if (images.length > 0) {
                imageURLs = await uploadAllImages();
                if (imageURLs.length === 0 && images.length > 0) { toast.error('Image upload failed.'); setIsPosting(false); return; }
            }
            const postData = {
                ...formData, loggeduser: loggeduser?._id, imageURLs,
                location: location.name ? location : null,
                music: music.title ? music : null,
            };
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/create`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(postData),
            });
            const data = await response.json();
            if (response.ok) {
                toast.success("Post created successfully");
                dispatch(addNewPost(data));
                images.forEach(img => URL.revokeObjectURL(img.preview));
                setImages([]);
                setFormData({ caption: "", category: "Default" });
                setLocation({ name: '', lat: null, lng: null });
                setMusic({ title: '', artist: '' });
                setShowExtras(false);
                setShowMusicInput(false);
            } else {
                toast.error(data.error || "Failed to create post");
            }
        } catch (error) {
            toast.error(error.message || "An unexpected error occurred");
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <>
            <div className="new mt-2 shadow-md p-2 rounded w-100">
                <div className="d-flex gap-2 align-items-center">
                    <img src={loggeduser?.profile_picture || "default-profile.png"} alt="Profile" className="logo" />
                    <form onSubmit={handleSubmit} className="flex gap-3 w-100">
                        <div className="flex flex-col w-100 gap-2">
                            <div className="flex w-100">
                                <input
                                    ref={captionRef}
                                    type="text"
                                    placeholder="# Tell your thoughts to your friends"
                                    className="py-2 px-4 bg-gray-100 rounded-full w-100"
                                    name="caption"
                                    value={formData.caption}
                                    onChange={handleChange}
                                />

                                {/* Emoji picker */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer"
                                    style={{ position: 'relative' }} onClick={() => setShowEmoji(v => !v)} title="Add emoji">
                                    <span style={{ fontSize: '18px' }}>😊</span>
                                    {showEmoji && <EmojiPicker onSelect={emoji => { handleEmojiSelect(emoji); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} />}
                                </span>

                                {/* Image picker */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()} title="Add images">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none">
                                        <path d="M10 13.229C10.1416 13.4609 10.3097 13.6804 10.5042 13.8828C11.7117 15.1395 13.5522 15.336 14.9576 14.4722C15.218 14.3121 15.4634 14.1157 15.6872 13.8828L18.9266 10.5114C20.3578 9.02184 20.3578 6.60676 18.9266 5.11718C17.4953 3.6276 15.1748 3.62761 13.7435 5.11718L13.03 5.85978" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                        <path d="M10.9703 18.14L10.2565 18.8828C8.82526 20.3724 6.50471 20.3724 5.07345 18.8828C3.64218 17.3932 3.64218 14.9782 5.07345 13.4886L8.31287 10.1172C9.74413 8.62761 12.0647 8.6276 13.4959 10.1172C13.6904 10.3195 13.8584 10.539 14 10.7708" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

                                {/* Extras toggle */}
                                <span className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer"
                                    onClick={() => setShowExtras(v => !v)} title="Location & music"
                                    style={{ background: showExtras ? '#f3f4f6' : '', fontSize: '16px' }}>＋</span>

                                {/* Submit */}
                                <button type="submit" className="border rounded-full bg-[#808bf5] flex items-center justify-center mx-1 p-2" disabled={isPosting}>
                                    {isPosting ? <span className="spinner-border spinner-border-sm text-white" role="status" /> : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#fff" fill="none">
                                            <path d="M11.922 4.79004C16.6963 3.16245 19.0834 2.34866 20.3674 3.63261C21.6513 4.91656 20.8375 7.30371 19.21 12.078L18.1016 15.3292C16.8517 18.9958 16.2267 20.8291 15.1964 20.9808C14.9195 21.0216 14.6328 20.9971 14.3587 20.9091C13.3395 20.5819 12.8007 18.6489 11.7231 14.783C11.4841 13.9255 11.3646 13.4967 11.0924 13.1692C11.0134 13.0742 10.9258 12.9866 10.8308 12.9076C10.5033 12.6354 10.0745 12.5159 9.21705 12.2769C5.35111 11.1993 3.41814 10.6605 3.0909 9.64127C3.00292 9.36724 2.97837 9.08053 3.01916 8.80355C3.17088 7.77332 5.00419 7.14834 8.6708 5.89838L11.922 4.79004Z" stroke="currentColor" strokeWidth="1.5" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* Location + Music extras */}
                            {showExtras && (
                                <div style={{ paddingLeft: '4px', display: 'flex', gap: '8px' }}>
                                    {/* Location */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button type="button" onClick={handleGetLocation} disabled={loadingLocation}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: location.name ? '#ede9fe' : '#f3f4f6', border: 'none', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', color: location.name ? '#6366f1' : '#6b7280' }}>
                                            📍 {loadingLocation ? 'Getting location...' : location.name || 'Add location'}
                                        </button>
                                        {location.name && (
                                            <button type="button" onClick={() => setLocation({ name: '', lat: null, lng: null })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' }}>✕</button>
                                        )}
                                    </div>

                                    {/* Music */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => setShowMusicInput(v => !v)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: music.title ? '#fdf2f8' : '#f3f4f6', border: 'none', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', color: music.title ? '#ec4899' : '#6b7280' }}>
                                            🎵 {music.title ? `${music.title}${music.artist ? ` — ${music.artist}` : ''}` : 'Add music'}
                                        </button>
                                        {music.title && (
                                            <button type="button" onClick={() => setMusic({ title: '', artist: '' })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' }}>✕</button>
                                        )}
                                    </div>
                                    {showMusicInput && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            <input type="text" placeholder="Song title" value={music.title}
                                                onChange={e => setMusic(prev => ({ ...prev, title: e.target.value }))}
                                                style={{ flex: 1, minWidth: '120px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
                                            <input type="text" placeholder="Artist" value={music.artist}
                                                onChange={e => setMusic(prev => ({ ...prev, artist: e.target.value }))}
                                                style={{ flex: 1, minWidth: '100px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
                                            <button type="button" onClick={() => setShowMusicInput(false)}
                                                style={{ padding: '5px 10px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Done</button>
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
                                <img src={img.preview} alt="preview"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', opacity: img.uploaded ? 1 : 0.7 }} />
                                {isPosting && !img.uploaded && (
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: '#e5e7eb', borderRadius: '0 0 8px 8px' }}>
                                        <div style={{ width: `${img.progress}%`, height: '100%', background: '#808bf5', borderRadius: '0 0 8px 8px', transition: 'width 0.2s' }} />
                                    </div>
                                )}
                                {img.uploaded && (
                                    <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#22c55e', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                                    </div>
                                )}
                                {!isPosting && (
                                    <button onClick={() => removeImage(img.id)}
                                        style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                                )}
                            </div>
                        ))}
                        {images.length < 5 && !isPosting && (
                            <div onClick={() => fileInputRef.current?.click()}
                                style={{ width: '80px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', fontSize: '24px' }}>+</div>
                        )}
                    </div>
                )}
            </div>
            <Toaster />
        </>
    );
};

export default NewPost;