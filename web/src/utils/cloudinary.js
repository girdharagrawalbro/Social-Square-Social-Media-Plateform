// import { backupUrlToDrive, uploadToDrive } from './drive';
import { api } from '../store/zustand/useAuthStore';
export const IMAGE_MAX_SIZE = 20 * 1024 * 1024; // 20 MB
export const VIDEO_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

async function uploadViaBackend(file, onProgress, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (options.folder) formData.append('folder', options.folder);
    if (options.resourceType) formData.append('resourceType', options.resourceType);

    const { data } = await api.post('/api/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
            if (onProgress && event.total) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        },
    });

    if (!data.success) throw new Error(data.message || 'Upload failed');

    return { url: data.url, publicId: data.publicId, source: 'server' };
}

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

export async function uploadMedia(file, onProgress, options = {}) {
    // ── 1. Size-based pre-check ───────────────────────────────────────────────
    const limit = options.resourceType === 'video' ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
    if (file.size > limit) {
        throw new Error(`File "${file.name}" exceeds the ${options.resourceType === 'video' ? '100MB video' : '20MB image'} size limit.`);
    }

    // ── 2. Attempt Cloudinary upload ─────────────────────────────────────────
    try {
        const result = await uploadViaBackend(file, onProgress, options);
        const secureUrl = result?.url;

        if (!secureUrl) {
            // Upload call returned 2xx but no URL — treat as failure
            throw new Error('returned no URL despite a successful response');
        }

        // ── 3. Silent Drive backup (fire-and-forget for disaster recovery) ───
        // backupUrlToDrive(secureUrl, {
        //     folder: options.folder ? `backups/${options.folder}` : 'backups/uploads',
        //     name: file.name,
        // }).catch(err => console.warn('[DriveBackup] Backup failed (non-critical):', err.message));
        // // ─────────────────────────────────────────────────────────────────────

        return {
            url: secureUrl,
            publicId: result?.publicId,
        };
    } catch (err) {
        // Re-throw so callers (post create, story upload, etc.) abort properly.
        // When Drive fallback is re-enabled, catch here and call it instead.
        console.error(`[Upload] Failed to upload "${file.name}":`, err.message);
        throw err;
    }
}

// async function _uploadToDriveWithFallback(file, onProgress, options, reason, originalError = null) {
//     try {
// const driveResult = await uploadToDrive(file, onProgress, {
//     folder: options.folder || `drive-fallback/${reason}`,
//     name: file.name,
// });

// console.log('[Drive Fallback] Upload result:', {
//     url: driveResult?.url ? 'present' : 'MISSING',
//     fileId: driveResult?.fileId,
//     source: 'drive'
// });

// if (!driveResult?.url) {
//     console.warn('[Drive Fallback] No URL in response:', driveResult);
//     throw new Error(`Google Drive upload returned no URL (fileId: ${driveResult?.fileId || 'unknown'})`);
// }

// Silent success — no user-facing notification
// console.info('[Drive Fallback] Upload successful:', driveResult.url.substring(0, 60) + '...');
// return { url: driveResult.url, publicId: null, source: 'drive' };
//     } catch (driveErr) {
//         // Log full diagnostics to the console only (never shown to the user)
//         const cloudinaryMsg = originalError
//             ? `Cloudinary: ${originalError.message}`
//             : 'Cloudinary: size limit exceeded';
//         console.error(
//             `[Upload] All providers failed for "${file.name}". ${cloudinaryMsg} | Drive: ${driveErr.message}`
//         );

//         // Generic user-facing error — no implementation details leaked
//         throw new Error('Something went wrong. Please try again.');
//     }
// }

export async function uploadVideo(file, onProgress, options = {}) {
    let thumbnailFile = null;
    try {
        thumbnailFile = await generateVideoThumbnail(file);
    } catch (err) {
        console.warn('[Video] Thumbnail generation failed, continuing without it:', err.message);
    }

    const videoResult = await uploadMedia(file, onProgress, {
        ...options,
        // Respect caller's resourceType (e.g. 'raw' for encrypted files).
        // Fall back to 'video' only when not specified.
        resourceType: options.resourceType || 'video',
    });
    let thumbnailUrl = null;
    if (thumbnailFile) {
        try {
            const thumbResult = await uploadMedia(thumbnailFile, null, {
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

export function validateImageType(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF and WebP images are allowed.';
    }
    return null;
}

export function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = IMAGE_MAX_SIZE;

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
    const maxSize = VIDEO_MAX_SIZE;

    if (!allowedTypes.includes(file.type)) {
        return 'Only MP4, WebM, MOV and OGG videos are allowed.';
    }
    if (file.size > maxSize) {
        return `Video exceeds 100MB`;
    }
    return null;
}
