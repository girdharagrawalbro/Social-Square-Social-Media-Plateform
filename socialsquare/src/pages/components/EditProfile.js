import React, { useState, useEffect, useRef } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { uploadToCloudinary, validateImageFile } from '../../utils/cloudinary';
import toast from 'react-hot-toast';

const MOODS = [
    { key: null, label: 'None (Default Feed)' },
    { key: 'happy', emoji: '😊', label: 'Happy' },
    { key: 'excited', emoji: '🤩', label: 'Excited' },
    { key: 'funny', emoji: '😂', label: 'Funny' },
    { key: 'romantic', emoji: '❤️', label: 'Romantic' },
    { key: 'inspirational', emoji: '💪', label: 'Inspire' },
    { key: 'calm', emoji: '😌', label: 'Calm' },
    { key: 'nostalgic', emoji: '🥹', label: 'Nostalgia' },
    { key: 'sad', emoji: '😢', label: 'Sad' },
];

const EditProfile = ({ users, closeSidebar }) => {
    const updateProfile = useAuthStore(s => s.updateProfile);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({ fullname: "", email: "", profile_picture: "", bio: "", preferredMood: null, isPrivate: false });
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        if (users) {
            setFormData({
                fullname: users.fullname || "",
                email: users.email || "",
                profile_picture: users.profile_picture || "",
                bio: users.bio || "",
                preferredMood: users.preferredMood ?? null,
                isPrivate: users.isPrivate || false,
            });
            setPreview(users.profile_picture || null);
        }
    }, [users]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // Convert empty string back to null for the mood select
        const finalValue = (name === 'preferredMood' && value === "") ? null : value;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : finalValue }));
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const error = validateImageFile(file);
        if (error) { toast.error(error); return; }

        // Show preview immediately
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);
        setUploading(true);
        setUploadProgress(0);

        try {
            const url = await uploadToCloudinary(file, (progress) => {
                setUploadProgress(progress);
            });
            setFormData(prev => ({ ...prev, profile_picture: url }));
            toast.success('Photo uploaded!');
        } catch {
            toast.error('Failed to upload image. Please try again.');
            setPreview(users?.profile_picture || null);
        } finally {
            setUploading(false);
            URL.revokeObjectURL(previewUrl);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (uploading) { toast.error('Please wait for image to finish uploading'); return; }
        const result = await updateProfile({ ...formData, userId: users?._id });
        if (result.success) {
            toast.success('Profile updated successfully!');
            closeSidebar();
        } else {
            toast.error(result.message || 'Failed to update profile');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full h-full">

            {/* Profile Picture Upload */}
            <div className="mb-4 flex flex-col items-center gap-2">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                        src={preview || '/default-profile.png'}
                        alt="Profile"
                        style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5e7eb' }}
                    />
                    {/* Upload overlay */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            position: 'absolute', bottom: 0, right: 0,
                            background: '#808bf5', border: 'none', borderRadius: '50%',
                            width: '28px', height: '28px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                    </button>
                </div>

                {/* Progress bar */}
                {uploading && (
                    <div style={{ width: '90px', height: '4px', background: '#e5e7eb', borderRadius: '2px' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#808bf5', borderRadius: '2px', transition: 'width 0.2s' }} />
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ fontSize: '12px', color: '#808bf5', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    {uploading ? `Uploading ${uploadProgress}%...` : 'Change photo'}
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>

            <div className="mb-3">
                <label htmlFor="fullname" className="block mb-1">Full Name</label>
                <input type="text" id="fullname" name="fullname" value={formData.fullname} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
            </div>

            <div className="mb-3">
                <label htmlFor="email" className="block mb-1">Email</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
            </div>

            <div className="mb-3">
                <label htmlFor="bio" className="block mb-1">Bio</label>
                <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} className="w-full border px-3 py-2 rounded" rows={3} />
            </div>

            <div className="mb-4">
                <label htmlFor="preferredMood" className="block mb-1 text-sm font-medium text-gray-700">Preferred Feed Mood</label>
                <select 
                    id="preferredMood" 
                    name="preferredMood" 
                    value={formData.preferredMood} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                    {MOODS.map(mood => (
                        <option key={mood.key} value={mood.key}>
                            {mood.emoji ? `${mood.emoji} ` : ''}{mood.label}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Choosing a mood will automatically blend related posts into your main feed.</p>
            </div>

            <div className="mb-6 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="m-0 text-sm font-bold text-indigo-900">Private Account</h4>
                        <p className="m-0 text-[11px] text-indigo-600 mt-0.5">Only people you approve can see your posts and stories.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            name="isPrivate"
                            checked={formData.isPrivate}
                            onChange={handleChange}
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            <button
                type="submit"
                disabled={uploading}
                className="btn btn-primary w-full text-white py-1 px-3 rounded"
                style={{ opacity: uploading ? 0.6 : 1 }}
            >
                {uploading ? 'Uploading...' : 'Save Changes'}
            </button>
        </form>
    );
};

export default EditProfile;