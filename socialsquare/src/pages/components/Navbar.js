import React, { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { addNewPost } from "../../store/slices/postsSlice";
import { uploadToCloudinary, validateImageFile } from "../../utils/cloudinary";

const NewPost = () => {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const { loggeduser } = useSelector((state) => state.users);

  const [formData, setFormData] = useState({ caption: "", category: "Default" });
  const [images, setImages] = useState([]); // [{ file, preview, url, progress, uploaded }]
  const [isPosting, setIsPosting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    const newImages = [];
    for (const file of files) {
      const error = validateImageFile(file);
      if (error) { toast.error(error); continue; }
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        url: null,
        progress: 0,
        uploaded: false,
        id: Math.random().toString(36).slice(2),
      });
    }
    setImages(prev => [...prev, ...newImages]);
    e.target.value = ''; // reset input
  };

  const removeImage = (id) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.preview) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
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
      // Upload all images to Cloudinary first
      let imageURLs = [];
      if (images.length > 0) {
        imageURLs = await uploadAllImages();
        if (imageURLs.length === 0 && images.length > 0) {
          toast.error('Image upload failed. Please try again.');
          setIsPosting(false);
          return;
        }
      }

      const postData = {
        ...formData,
        loggeduser: loggeduser?._id,
        imageURLs, // array of URLs
      };

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Post created successfully");
        dispatch(addNewPost(data));
        // Cleanup
        images.forEach(img => URL.revokeObjectURL(img.preview));
        setImages([]);
        setFormData({ caption: "", category: "Default" });
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
            <div className="flex w-100">
              <input
                type="text"
                placeholder="# Tell your thoughts to your friends"
                className="py-2 px-4 bg-gray-100 rounded-full w-100"
                name="caption"
                value={formData.caption}
                onChange={handleChange}
              />

              {/* Image picker button */}
              <span
                className="border rounded-full flex items-center justify-center ms-1 p-2 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                title="Add images"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path d="M10 13.229C10.1416 13.4609 10.3097 13.6804 10.5042 13.8828C11.7117 15.1395 13.5522 15.336 14.9576 14.4722C15.218 14.3121 15.4634 14.1157 15.6872 13.8828L18.9266 10.5114C20.3578 9.02184 20.3578 6.60676 18.9266 5.11718C17.4953 3.6276 15.1748 3.62761 13.7435 5.11718L13.03 5.85978" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10.9703 18.14L10.2565 18.8828C8.82526 20.3724 6.50471 20.3724 5.07345 18.8828C3.64218 17.3932 3.64218 14.9782 5.07345 13.4886L8.31287 10.1172C9.74413 8.62761 12.0647 8.6276 13.4959 10.1172C13.6904 10.3195 13.8584 10.539 14 10.7708" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

              {/* Submit button */}
              <button type="submit" className="border rounded-full bg-[#808bf5] flex items-center justify-center mx-1 p-2" disabled={isPosting}>
                {isPosting ? (
                  <span className="spinner-border spinner-border-sm text-white" role="status" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#fff" fill="none">
                    <path d="M11.922 4.79004C16.6963 3.16245 19.0834 2.34866 20.3674 3.63261C21.6513 4.91656 20.8375 7.30371 19.21 12.078L18.1016 15.3292C16.8517 18.9958 16.2267 20.8291 15.1964 20.9808C14.9195 21.0216 14.6328 20.9971 14.3587 20.9091C13.3395 20.5819 12.8007 18.6489 11.7231 14.783C11.4841 13.9255 11.3646 13.4967 11.0924 13.1692C11.0134 13.0742 10.9258 12.9866 10.8308 12.9076C10.5033 12.6354 10.0745 12.5159 9.21705 12.2769C5.35111 11.1993 3.41814 10.6605 3.0909 9.64127C3.00292 9.36724 2.97837 9.08053 3.01916 8.80355C3.17088 7.77332 5.00419 7.14834 8.6708 5.89838L11.922 4.79004Z" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Image previews */}
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingLeft: '44px' }}>
            {images.map((img) => (
              <div key={img.id} style={{ position: 'relative', width: '80px', height: '80px' }}>
                <img
                  src={img.preview}
                  alt="preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', opacity: img.uploaded ? 1 : 0.7 }}
                />
                {/* Progress bar */}
                {isPosting && !img.uploaded && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '4px', background: '#e5e7eb', borderRadius: '0 0 8px 8px'
                  }}>
                    <div style={{ width: `${img.progress}%`, height: '100%', background: '#808bf5', borderRadius: '0 0 8px 8px', transition: 'width 0.2s' }} />
                  </div>
                )}
                {/* Uploaded checkmark */}
                {img.uploaded && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#22c55e', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                  </div>
                )}
                {/* Remove button */}
                {!isPosting && (
                  <button
                    onClick={() => removeImage(img.id)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >✕</button>
                )}
              </div>
            ))}
            {/* Add more button */}
            {images.length < 5 && !isPosting && (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '80px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', fontSize: '24px' }}
              >+</div>
            )}
          </div>
        )}
      </div>
      <Toaster />
    </>
  );
};

export default NewPost;