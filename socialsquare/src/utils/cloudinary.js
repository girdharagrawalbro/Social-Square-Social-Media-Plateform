const CLOUDINARY_API_BASE_URL =
    process.env.REACT_APP_CLOUDINARY_API_BASE_URL;

function fileToDataUrl(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress(Math.min(90, Math.round((event.loaded / event.total) * 90)));
            }
        };

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file before upload'));

        reader.readAsDataURL(file);
    });
}

async function requestCloudinaryApi(path, method, body) {
    const response = await fetch(`${CLOUDINARY_API_BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.success === false) {
        throw new Error(json?.message || 'Cloudinary API request failed');
    }
    return json;
}

/**
 * Generates a thumbnail image from a video file using the browser's Canvas API.
 */
export function generateVideoThumbnail(videoFile, seekTime = 1) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Allow cross-origin if needed, though usually local Blob
        video.crossOrigin = "anonymous";
        video.src = URL.createObjectURL(videoFile);
        video.currentTime = seekTime;
        video.muted = true; // Required for mobile autoplay/preview sometimes

        video.addEventListener('loadeddata', () => {
            // Handle case where seekTime is longer than video
            if (seekTime > video.duration) {
                video.currentTime = Math.min(1, video.duration / 2);
            }
        });

        video.addEventListener('seeked', () => {
            try {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], 'thumb.jpg', { type: 'image/jpeg' });
                        resolve(file);
                    } else {
                        reject(new Error('Failed to generate thumbnail blob'));
                    }
                }, 'image/jpeg', 0.85);
            } catch (err) {
                reject(err);
            } finally {
                URL.revokeObjectURL(video.src);
            }
        });

        video.addEventListener('error', (e) => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video for thumbnail generation'));
        });
    });
}

export async function uploadToCloudinary(file, onProgress, options = {}) {
    const fileBase64 = await fileToDataUrl(file, onProgress);
    const payload = {
        file: fileBase64,
        folder: options.folder,
        resourceType: options.resourceType,
        start_offset: options.start_offset,
        end_offset: options.end_offset,
    };

    const json = await requestCloudinaryApi('/upload-base64', 'POST', payload);
    const result = json?.data;
    const secureUrl = result?.secure_url;

    if (!secureUrl) {
        throw new Error('Cloudinary upload succeeded but secure_url is missing');
    }

    if (onProgress) onProgress(100);

    return {
        url: secureUrl,
        publicId: result?.public_id
    };
}

export async function uploadVideoToCloudinary(file, onProgress, options = {}) {
    // 1. Generate thumbnail first
    let thumbnailFile = null;
    try {
        thumbnailFile = await generateVideoThumbnail(file);
    } catch (err) {
        console.warn('Thumbnail generation failed, continuing with video only', err);
    }

    // 2. Upload video
    const videoResult = await uploadToCloudinary(file, onProgress, {
        ...options,
        resourceType: 'video',
    });

    // 3. Upload thumbnail as an image if generated
    let thumbnailUrl = null;
    if (thumbnailFile) {
        try {
            const thumbResult = await uploadToCloudinary(thumbnailFile);
            thumbnailUrl = thumbResult.url;
        } catch (err) {
            console.error('Failed to upload thumbnail', err);
        }
    }

    return {
        ...videoResult,
        thumbnailUrl
    };
}

export async function deleteFromCloudinary(publicId, resourceType = 'image') {
    const json = await requestCloudinaryApi('/delete', 'DELETE', {
        publicId,
        resourceType,
    });
    return json?.data;
}

export function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF and WebP images are allowed.';
    }
    if (file.size > maxSize) {
        return 'Image must be under 10MB.';
    }
    return null;
}

export function validateVideoFile(file) {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
    const maxSize = 50 * 1024 * 1024; // 50MB recommended for Cloudinary uploads

    if (!allowedTypes.includes(file.type)) {
        return 'Only MP4, WebM, MOV and OGG videos are allowed.';
    }
    if (file.size > maxSize) {
        return `Video must be under ${Math.round(maxSize / (1024 * 1024))}MB.`;
    }
    return null;
}