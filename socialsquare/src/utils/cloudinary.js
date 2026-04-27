// ─── CLOUDINARY + DRIVE BACKUP UTILITY ───────────────────────────────────────
// All uploads go to Cloudinary (public CDN).
// Every successful upload is ALSO silently backed up to Google Drive
// (disaster recovery + raw original storage).
// If a file EXCEEDS the Cloudinary size limit, it falls back to Drive
// automatically, and the same { url } shape is returned.
// ──────────────────────────────────────────────────────────────────────────────
import { backupUrlToDrive, uploadToDrive } from './drive';

// The hard limit enforced by the Cloudinary service (set in clodinary/index.js).
// Files LARGER than this are transparently uploaded to Google Drive instead.
export const IMAGE_CLOUDINARY_MAX_SIZE = 20 * 1024 * 1024; // 20 MB
export const VIDEO_CLOUDINARY_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

const CLOUDINARY_API_BASE_URL = process.env.REACT_APP_CLOUDINARY_API_BASE_URL;

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
    // ── Drive fallback for oversized files ───────────────────────────────────
    // If the file exceeds the Cloudinary limit, upload directly to Drive.
    const limit = options.resourceType === 'video' ? VIDEO_CLOUDINARY_MAX_SIZE : IMAGE_CLOUDINARY_MAX_SIZE;
    if (file.size > limit) {
        console.info('[Cloudinary] File exceeds limit, falling back to Drive:', file.name);
        const driveResult = await uploadToDrive(file, onProgress, {
            folder: options.folder || 'cloudinary-oversize',
            name: file.name,
        });
        return { url: driveResult.url, publicId: null, source: 'drive' };
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    // ── Silent Drive backup (fire-and-forget) ──────────────────────────────────
    // Backs up the original to Google Drive asynchronously.
    // Never blocks or fails the main upload flow.
    backupUrlToDrive(secureUrl, {
        folder: options.folder ? `backups/${options.folder}` : 'backups/uploads',
        name: file.name,
    }).catch(err => console.warn('[DriveBackup] Backup failed (non-critical):', err.message));
    // ──────────────────────────────────────────────────────────────────────────

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

// ⚠️  DELETE IS INTENTIONALLY DISABLED.
// Cloudinary assets are kept forever — deleting a post or piece of content
// in Social Square does NOT remove the underlying media file from Cloudinary.
// Do not re-enable this without a deliberate storage-cleanup strategy.
export async function deleteFromCloudinary(_publicId, _resourceType = 'image') {
    // no-op — deletion from Cloudinary is disabled by policy
    return null;
}

/**
 * Validates ONLY the file TYPE (not size).
 * Use this when you want to hard-block unsupported formats but still allow
 * oversized files to fall back to Google Drive automatically.
 */
export function validateImageType(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF and WebP images are allowed.';
    }
    return null;
}

export function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = IMAGE_CLOUDINARY_MAX_SIZE;

    if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF and WebP images are allowed.';
    }
    if (file.size > maxSize) {
        return `Image exceeds 20MB — it will be stored on Google Drive instead.`;

    }
    return null;
}

export function validateVideoType(file) {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
    if (!allowedTypes.includes(file.type)) {
        return 'Only MP4, WebM, MOV and OGG videos are allowed.';
    }
    return null;
}

export function validateVideoFile(file) {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
    const maxSize = VIDEO_CLOUDINARY_MAX_SIZE;

    if (!allowedTypes.includes(file.type)) {
        return 'Only MP4, WebM, MOV and OGG videos are allowed.';
    }
    if (file.size > maxSize) {
        return `Video exceeds 100MB`;
    }
    return null;
}
