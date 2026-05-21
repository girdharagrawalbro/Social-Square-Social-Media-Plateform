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
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Drive returns file metadata on successful PUT completion
                    let data = {};
                    console.log('[Drive] Upload response status:', xhr.status, 'Content-Type:', xhr.getResponseHeader('Content-Type'));
                    
                    try {
                        const responseText = xhr.responseText;
                        console.log('[Drive] Response body length:', responseText?.length, 'First 100 chars:', responseText?.substring(0, 100));
                        if (responseText && responseText.trim()) {
                            data = JSON.parse(responseText);
                            console.log('[Drive] Parsed metadata:', { id: data.id, name: data.name, hasWebContentLink: !!data.webContentLink });
                        }
                    } catch (e) {
                        console.warn('[Drive] Response parsing failed:', e.message);
                        // If response body is empty, try to get Location header or other metadata
                        const locationHeader = xhr.getResponseHeader('Location');
                        if (locationHeader) {
                            console.log('[Drive] Using Location header:', locationHeader);
                            data = { webContentLink: locationHeader };
                        }
                    }
                    
                    // If we still have no metadata, we have a problem
                    if (!data.webContentLink && !data.webViewLink && !data.id) {
                        console.error('[Drive] No file metadata found in response. Data:', data);
                        reject(new Error('Upload succeeded but no file metadata was returned'));
                    } else {
                        console.log('[Drive] Successfully formatted result for URL:', data.webContentLink || data.webViewLink || 'Drive ID: ' + data.id);
                        resolve(formatResult(data));
                    }
                } else {
                    let errorDetail = 'Unknown error';
                    try {
                        const errorRes = JSON.parse(xhr.responseText);
                        errorDetail = errorRes.error?.message || errorRes.message || xhr.responseText;
                    } catch (e) {
                        errorDetail = xhr.responseText || xhr.statusText;
                    }
                    reject(new Error(`Drive upload failed with status ${xhr.status}: ${errorDetail}`));
                }
            } catch (e) {
                reject(new Error('Error processing Drive upload response: ' + e.message));
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
