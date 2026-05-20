// ─── GOOGLE DRIVE UPLOAD UTILITY ─────────────────────────────────────────────
// Mirrors the interface of cloudinary.js so both can be used interchangeably.
//
// Usage:
//   import { uploadToDrive, uploadFileToDrive } from '../../utils/drive';
//
//   console.log(result.url);         // public webContentLink (CDN-style)
//   console.log(result.fileId);      // Google Drive file ID
//   console.log(result.name);        // stored filename
//   console.log(result.mimeType);    // detected MIME type
// ──────────────────────────────────────────────────────────────────────────────
import { api } from '../store/zustand/useAuthStore';

const DRIVE_API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api/media/drive`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────


async function requestDriveApi(path, method = 'POST', body) {
    const response = await api({
        method,
        url: `/api/media/drive${path}`,
        data: body,
    }).then(r => r.data);

    if (response?.success === false) {
        throw new Error(response?.message || 'Drive API request failed');
    }
    return response;
}

// ─── FORMAT RESPONSE (normalised shape) ──────────────────────────────────────

function formatResult(data = {}) {
    return {
        // Primary CDN-style URL — use this like Cloudinary's secure_url
        url: data.webContentLink || data.webViewLink || null,
        // Extra Drive-specific fields
        fileId: data.fileId || null,
        name: data.name || null,
        mimeType: data.mimeType || null,
        size: data.size || null,
        webViewLink: data.webViewLink || null,
        webContentLink: data.webContentLink || null,
        thumbnailLink: data.thumbnailLink || null,
    };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Uploads ANY file type DIRECTLY to Google Drive using a resumable session.
 * This bypasses the main backend process for large file data.
 */
export async function uploadToDrive(file, onProgress, options = {}) {
    // 1. Get resumable session URL from our backend
    const { sessionUrl, success, message } = await api.post('/api/media/drive/sign-upload', {
        name: options.name || file.name,
        mimeType: file.type,
        folder: options.folder
    }).then(r => r.data);

    if (!success) throw new Error(message || 'Failed to initiate Drive upload');

    // 2. Upload DIRECTLY to Google's session URL
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sessionUrl, true);
        // Resumable uploads use PUT and don't need the Auth token (it's encoded in the sessionUrl)

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
                // Drive returns the file metadata on successful PUT completion
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(formatResult(data));
                } else {
                    reject(new Error('Direct Drive upload failed'));
                }
            } catch (e) {
                // If it's a 200/201 but body is empty, we might need to fetch metadata separately
                // but usually Drive returns the object.
                resolve(formatResult({ fileId: 'uploaded' })); 
            }
        };

        xhr.onerror = () => reject(new Error('Network error during direct Drive upload'));
        xhr.send(file); // Send raw file blob
    });
}

/**
 * Alias of uploadToDrive — explicit name for non-image/video files.
 * Use this for PDFs, ZIPs, DOCXs, etc. in chat or profile uploads.
 */
export async function uploadFileToDrive(file, onProgress, options = {}) {
    return uploadToDrive(file, onProgress, options);
}

/**
 * Uploads a remote URL's content to Drive (re-upload / backup).
 *
 * @param {string} url            Public URL of the file to back up
 * @param {Object} options        { folder, name }
 */
export async function backupUrlToDrive(url, options = {}) {
    const json = await requestDriveApi('/upload-url', 'POST', {
        url,
        folder: options.folder || 'social-square-backups',
        name: options.name,
    });
    // return formatResult(json?.data);
    return { success: json.success };
}

/**
 * Gets metadata for a Drive file by its ID.
 *
 * @param {string} fileId  Google Drive file ID
 */
export async function getDriveFile(fileId) {
    const json = await requestDriveApi(`/file/${fileId}`, 'GET');
    return formatResult(json?.data);
}

/**
 * Returns a human-readable file size string (e.g. "3.2 MB").
 */
export function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Returns an appropriate emoji icon for a given MIME type or filename.
 * Useful for rendering file previews in chat.
 */
export function getFileIcon(mimeType = '', fileName = '') {
    const type = mimeType.toLowerCase();
    const ext = (fileName.split('.').pop() || '').toLowerCase();

    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf') || ext === 'pdf') return '📄';
    if (type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
    if (type.includes('word') || ['doc', 'docx'].includes(ext)) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (type.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return '📊';
    if (type.includes('text') || ['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return '📃';
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rb', 'php'].includes(ext)) return '💻';
    return '📎';
}
