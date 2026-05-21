// ─── CLOUDINARY + DRIVE BACKUP UTILITY ───────────────────────────────────────
// All uploads go to Cloudinary (public CDN).
// Every successful upload is ALSO silently backed up to Google Drive
// (disaster recovery + raw original storage).
// If a file EXCEEDS the Cloudinary size limit, it falls back to Drive
// automatically, and the same { url } shape is returned.
// ──────────────────────────────────────────────────────────────────────────────
import { backupUrlToDrive, uploadToDrive } from './drive';
import { api } from '../store/zustand/useAuthStore';

// The hard limit enforced by the Cloudinary service (set in clodinary/index.js).
// Files LARGER than this are transparently uploaded to Google Drive instead.
export const IMAGE_CLOUDINARY_MAX_SIZE = 20 * 1024 * 1024; // 20 MB
export const VIDEO_CLOUDINARY_MAX_SIZE = 100 * 1024 * 1024; // 100 MB


/**
 * Uploads media DIRECTLY to Cloudinary using a signature from our backend.
 * This bypasses the main backend process for large file data.
 */
async function uploadDirectToCloudinary(file, onProgress, options = {}) {
    // 1. Get signature from our backend
    const { signature, timestamp, cloudName = "dcmrsdydh", apiKey, folder, success, message } =
        await api.post('/api/media/sign-upload', { folder: options.folder }).then(r => r.data);

    if (!success) throw new Error(message || 'Failed to get upload signature');

    // 2. Build FormData for direct Cloudinary upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('folder', folder);

    if (options.resourceType) formData.append('resource_type', options.resourceType);

    // 3. Upload directly to Cloudinary
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, true);

        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        url: data.secure_url,
                        publicId: data.public_id,
                        resourceType: data.resource_type,
                        duration: data.duration,
                        width: data.width,
                        height: data.height,
                    });
                } else {
                    reject(new Error(data.error?.message || 'Direct upload failed'));
                }
            } catch (e) { reject(new Error('Invalid response from Cloudinary')); }
        };

        xhr.onerror = () => reject(new Error('Network error during direct upload'));
        xhr.send(formData);
    });
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
    // ── 1. Size-based pre-check: route oversized files directly to Drive ─────
    const limit = options.resourceType === 'video' ? VIDEO_CLOUDINARY_MAX_SIZE : IMAGE_CLOUDINARY_MAX_SIZE;
    if (file.size > limit) {
        console.info('[Cloudinary] File exceeds size limit → routing to Drive:', file.name);
        return _uploadToDriveWithFallback(file, onProgress, options, 'size-limit');
    }

    // ── 2. Attempt Cloudinary upload ─────────────────────────────────────────
    let cloudinaryError = null;
    try {
        const result = await uploadDirectToCloudinary(file, onProgress, options);
        const secureUrl = result?.url;

        if (!secureUrl) {
            // Upload call returned 2xx but no URL — treat as failure
            throw new Error('Cloudinary returned no URL despite a successful response');
        }

        // ── 3. Silent Drive backup (fire-and-forget for disaster recovery) ───
        backupUrlToDrive(secureUrl, {
            folder: options.folder ? `backups/${options.folder}` : 'backups/uploads',
            name: file.name,
        }).catch(err => console.warn('[DriveBackup] Backup failed (non-critical):', err.message));
        // ─────────────────────────────────────────────────────────────────────

        return {
            url: secureUrl,
            publicId: result?.publicId,
            source: 'cloudinary',
        };
    } catch (err) {
        cloudinaryError = err;
        // Any failure (network error, downtime, bad credentials, no URL, etc.)
        // falls through to the Drive fallback below.
        console.warn(
            `[Cloudinary] Upload failed (${err.message}). Falling back to Google Drive for: ${file.name}`
        );
    }

    // ── 4. Drive fallback ────────────────────────────────────────────────────
    return _uploadToDriveWithFallback(file, onProgress, options, 'cloudinary-failure', cloudinaryError);
}

/**
 * Internal helper — uploads to Drive and returns the normalised result shape.
 * Silently falls back to Drive; the user is never told which provider is being used.
 * If Drive also fails, a generic user-facing error is thrown while the full
 * diagnostic details are written to the console only.
 *
 * @param {string} reason        - Short label for console logs (e.g. 'size-limit')
 * @param {Error}  originalError - The upstream Cloudinary error, if any
 */
async function _uploadToDriveWithFallback(file, onProgress, options, reason, originalError = null) {
    try {
        const driveResult = await uploadToDrive(file, onProgress, {
            folder: options.folder || `drive-fallback/${reason}`,
            name: file.name,
        });

        console.log('[Drive Fallback] Upload result:', { 
            url: driveResult?.url ? 'present' : 'MISSING', 
            fileId: driveResult?.fileId, 
            source: 'drive' 
        });

        if (!driveResult?.url) {
            console.warn('[Drive Fallback] No URL in response:', driveResult);
            throw new Error(`Google Drive upload returned no URL (fileId: ${driveResult?.fileId || 'unknown'})`);
        }

        // Silent success — no user-facing notification
        console.info('[Drive Fallback] Upload successful:', driveResult.url.substring(0, 60) + '...');
        return { url: driveResult.url, publicId: null, source: 'drive' };
    } catch (driveErr) {
        // Log full diagnostics to the console only (never shown to the user)
        const cloudinaryMsg = originalError
            ? `Cloudinary: ${originalError.message}`
            : 'Cloudinary: size limit exceeded';
        console.error(
            `[Upload] All providers failed for "${file.name}". ${cloudinaryMsg} | Drive: ${driveErr.message}`
        );

        // Generic user-facing error — no implementation details leaked
        throw new Error('Something went wrong. Please try again.');
    }
}

export async function uploadVideoToCloudinary(file, onProgress, options = {}) {
    // 1. Generate thumbnail first (best-effort — does not block video upload)
    let thumbnailFile = null;
    try {
        thumbnailFile = await generateVideoThumbnail(file);
    } catch (err) {
        console.warn('[Video] Thumbnail generation failed, continuing without it:', err.message);
    }

    // 2. Upload video — Cloudinary with Drive fallback (handled inside uploadToCloudinary)
    const videoResult = await uploadToCloudinary(file, onProgress, {
        ...options,
        resourceType: 'video',
    });

    // 3. Upload thumbnail — also uses the same Cloudinary→Drive resilience path
    let thumbnailUrl = null;
    if (thumbnailFile) {
        try {
            const thumbResult = await uploadToCloudinary(thumbnailFile, null, {
                folder: options.folder || 'thumbnails',
            });
            thumbnailUrl = thumbResult.url;
        } catch (err) {
            // Thumbnail is best-effort; a missing thumbnail must never block a video post.
            console.warn('[Video] Thumbnail upload failed (non-critical):', err.message);
        }
    }

    return {
        ...videoResult,
        thumbnailUrl,
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
