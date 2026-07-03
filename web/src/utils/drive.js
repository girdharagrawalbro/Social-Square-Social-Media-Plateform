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
        url: `${DRIVE_API_BASE_URL}${path}`,
        data: body,
    }).then(r => r.data);

    if (response?.success === false) {
        throw new Error(response?.message || 'Drive API request failed');
    }
    return response;
}

// ─── FORMAT RESPONSE (normalised shape) ──────────────────────────────────────

function formatResult(data = {}) {
    // Ensure we always have a usable URL
    let url = data.webContentLink || data.webViewLink || null;

    // If we have a fileId but no URL, construct a Drive URL
    if (!url && data.fileId && data.fileId !== 'uploaded') {
        url = `https://drive.google.com/file/d/${data.fileId}/view`;
    }

    return {
        // Primary CDN-style URL — use this like Cloudinary's secure_url
        url,
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
    // Convert file to base64 data URL
    const toBase64 = (f) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

    const base64File = await toBase64(file);

    if (onProgress) onProgress(30); // Show incremental progress

    const response = await api.post('/api/media/drive/upload', {
        file: base64File,
        name: options.name || file.name,
        folder: options.folder
    }).then(r => r.data);

    if (onProgress) onProgress(100);

    if (response?.success === false) {
        throw new Error(response?.message || 'Drive upload failed');
    }

    return formatResult(response.data);
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
