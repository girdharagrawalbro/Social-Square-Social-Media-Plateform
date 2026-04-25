// ─── GOOGLE DRIVE SERVICE ──────────────────────────────────────────────────────
// All Drive SDK calls are isolated here — routes stay thin.
// Functions mirror the Cloudinary service interface:
//   uploadFile   ←→  uploadBase64
//   uploadFromUrl←→  uploadFromUrl
//   deleteFile   ←→  deleteAsset
//   getFile      ←→  cld.api.resource
//   listFiles    ←→  cld.api.resources
// ──────────────────────────────────────────────────────────────────────────────

const { Readable } = require('stream');
const axios = require('axios');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const { getDrive } = require('../config/google.config');

// ─── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Converts a Buffer into a Node.js Readable stream
 * (required by the Drive resumable upload API).
 */
function bufferToStream(buffer) {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    return readable;
}

/**
 * Parses a base64 data-URI string and returns { buffer, mimeType }.
 * Supports:  "data:image/png;base64,iVBOR..."
 *            "iVBOR..." (raw base64, no header)
 */
function parseBase64(base64String) {
    if (base64String.startsWith('data:')) {
        const [header, data] = base64String.split(',');
        const mimeType = header.replace('data:', '').replace(';base64', '');
        return { buffer: Buffer.from(data, 'base64'), mimeType };
    }
    // Raw base64 — assume binary/octet-stream
    return { buffer: Buffer.from(base64String, 'base64'), mimeType: 'application/octet-stream' };
}

/**
 * Formats a raw Drive API file resource into the DriveStore standard response shape.
 */
function formatFileResponse(file) {
    return {
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : null,
        webViewLink: file.webViewLink || null,
        webContentLink: file.webContentLink || null,
        thumbnailLink: file.thumbnailLink || null,
        createdTime: file.createdTime || null,
        parents: file.parents || [],
    };
}

// ─── CORE OPERATIONS ───────────────────────────────────────────────────────────

/**
 * Resolves (or creates) a named sub-folder inside the root Drive folder.
 * Returns the folder ID.
 *
 * @param {string} folderName   e.g. "uploads" or "ai-generated"
 * @param {string} parentId     Root Drive folder ID from env
 */
async function resolveFolder(folderName, parentId) {
    const drive = getDrive();

    // Search for an existing folder with this name inside parentId
    const searchRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id;
    }

    // Create the folder
    const createRes = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
    });

    return createRes.data.id;
}

/**
 * Makes a file publicly readable by anyone with the link.
 * This is what generates the usable webContentLink (acts as CDN URL).
 */
async function setPublicPermission(fileId) {
    const drive = getDrive();
    await drive.permissions.create({
        fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });
}

// ─── PUBLIC SERVICE FUNCTIONS ──────────────────────────────────────────────────

/**
 * Uploads a Buffer to Google Drive.
 *
 * @param {Buffer} buffer        File bytes
 * @param {string} fileName      Original filename (used for Drive display name)
 * @param {string} mimeType      e.g. "image/jpeg", "video/mp4", "application/pdf"
 * @param {Object} options
 * @param {string} [options.folder]   Sub-folder name inside the root Drive folder
 * @param {string} [options.name]     Override the stored filename
 * @returns {Object} Formatted file response
 */
async function uploadFile(buffer, fileName, mimeType, options = {}) {
    const drive = getDrive();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!rootFolderId) {
        throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.');
    }

    // Determine parent folder (root or named sub-folder)
    let parentId = rootFolderId;
    if (options.folder) {
        parentId = await resolveFolder(options.folder, rootFolderId);
    }

    const storedName = options.name || fileName || `upload-${uuidv4()}`;

    const fileMetadata = {
        name: storedName,
        parents: [parentId],
    };

    const media = {
        mimeType,
        body: bufferToStream(buffer),
    };

    const uploadRes = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, parents',
    });

    const fileId = uploadRes.data.id;

    // Make it publicly accessible so webContentLink works as a CDN URL
    await setPublicPermission(fileId);

    // Re-fetch with the now-populated webContentLink
    const fileRes = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, parents',
    });

    return formatFileResponse(fileRes.data);
}

/**
 * Uploads a base64-encoded string (with or without data-URI header) to Drive.
 *
 * @param {string} base64String   "data:image/png;base64,..." or raw base64
 * @param {Object} options        { folder, name }
 */
async function uploadBase64(base64String, options = {}) {
    const { buffer, mimeType } = parseBase64(base64String);
    const ext = mime.extension(mimeType) || 'bin';
    const fileName = options.name || `upload-${uuidv4()}.${ext}`;
    return uploadFile(buffer, fileName, mimeType, options);
}

/**
 * Downloads a remote file by URL and then uploads it to Drive.
 *
 * @param {string} url       Public URL of the file to re-upload
 * @param {Object} options   { folder, name }
 */
async function uploadFromUrl(url, options = {}) {
    // Download the file as a buffer
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        maxContentLength: 100 * 1024 * 1024,
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const mimeType = contentType.split(';')[0].trim();
    const ext = mime.extension(mimeType) || 'bin';

    // Try to derive a filename from the URL path
    const urlPath = new URL(url).pathname;
    const urlFileName = urlPath.split('/').pop() || `download-${uuidv4()}.${ext}`;
    const fileName = options.name || urlFileName;

    return uploadFile(buffer, fileName, mimeType, options);
}

/**
 * Permanently deletes a file from Google Drive by its file ID.
 *
 * @param {string} fileId   Google Drive file ID
 */
async function deleteFile(fileId) {
    const drive = getDrive();
    await drive.files.delete({ fileId });
    return { fileId, deleted: true };
}

/**
 * Retrieves metadata for a single file.
 *
 * @param {string} fileId
 */
async function getFile(fileId) {
    const drive = getDrive();
    const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, parents',
    });
    return formatFileResponse(res.data);
}

/**
 * Lists files inside a given Drive folder (defaults to root folder).
 *
 * @param {string|null} folderId   Drive folder ID (null → root folder from env)
 * @param {number}      pageSize   Max results (default 20, max 100)
 * @param {string|null} pageToken  Pagination token for next page
 */
async function listFiles(folderId = null, pageSize = 20, pageToken = null) {
    const drive = getDrive();
    const targetFolderId = folderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!targetFolderId) {
        throw new Error('No folderId provided and GOOGLE_DRIVE_ROOT_FOLDER_ID is not set.');
    }

    const params = {
        q: `'${targetFolderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime)',
        pageSize: Math.min(Number(pageSize) || 20, 100),
        spaces: 'drive',
        orderBy: 'createdTime desc',
    };

    if (pageToken) params.pageToken = pageToken;

    const res = await drive.files.list(params);

    return {
        files: (res.data.files || []).map(formatFileResponse),
        nextPageToken: res.data.nextPageToken || null,
    };
}

module.exports = {
    uploadFile,
    uploadBase64,
    uploadFromUrl,
    deleteFile,
    getFile,
    listFiles,
    setPublicPermission,
};
