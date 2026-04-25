// ─── GOOGLE DRIVE UPLOAD UTILITY ─────────────────────────────────────────────
// Mirrors the interface of cloudinary.js so both can be used interchangeably.
//
// Usage:
//   import { uploadToDrive, uploadFileToDrive } from '../../utils/drive';
//
//   const result = await uploadToDrive(file, { folder: 'chat-files' });
//   console.log(result.url);         // public webContentLink (CDN-style)
//   console.log(result.fileId);      // Google Drive file ID
//   console.log(result.name);        // stored filename
//   console.log(result.mimeType);    // detected MIME type
// ──────────────────────────────────────────────────────────────────────────────

const DRIVE_API_BASE_URL = process.env.REACT_APP_GDRIVE_API_BASE_URL || 'http://localhost:5002';

// ─── HELPERS ─────────────────────────────────────────────────────────────────


async function requestDriveApi(path, method = 'POST', body) {
    const baseUrl = (DRIVE_API_BASE_URL || '').replace(/\/+$/, '');
    const url = `${baseUrl}/api/drive${path}`;

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.success === false) {
        throw new Error(json?.message || 'Drive API request failed');
    }
    return json;
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
 * Uploads ANY file type to Google Drive using base64 encoding.
 * Works for images, videos, PDFs, ZIPs, DOCXs — literally any file.
 * No file size limit (Drive storage is effectively unlimited).
 *
 * @param {File}     file         Browser File object
 * @param {Function} onProgress   Optional progress callback (0-100)
 * @param {Object}   options
 * @param {string}   [options.folder]  Sub-folder name in Drive (e.g. 'chat-files')
 * @param {string}   [options.name]    Override stored filename
 * @returns {{ url, fileId, name, mimeType, size, webViewLink, webContentLink }}
 */
export async function uploadToDrive(file, onProgress, options = {}) {
    const baseUrl = (process.env.REACT_APP_GDRIVE_API_BASE_URL || 'http://localhost:5002').replace(/\/+$/, '');
    const url = `${baseUrl}/api/drive/upload`;

    const formData = new FormData();
    formData.append('file', file);
    if (options.folder) formData.append('folder', options.folder);
    if (options.name || file.name) formData.append('name', options.name || file.name);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);

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
                const json = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && json.success !== false) {
                    resolve(formatResult(json?.data));
                } else {
                    reject(new Error(json?.message || 'Drive API request failed'));
                }
            } catch (e) {
                reject(new Error('Invalid server response'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
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
    return formatResult(json?.data);
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
