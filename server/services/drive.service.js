// ─── GOOGLE DRIVE SERVICE ──────────────────────────────────────────────────────
// Integrated directly into Social Square backend

const { Readable } = require('stream');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { getDrive, getAuth } = require('../config/google.config');

function bufferToStream(buffer) {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    return readable;
}

function parseBase64(base64String) {
    if (base64String.startsWith('data:')) {
        const [header, data] = base64String.split(',');
        const mimeType = header.replace('data:', '').replace(';base64', '');
        return { buffer: Buffer.from(data, 'base64'), mimeType };
    }
    return { buffer: Buffer.from(base64String, 'base64'), mimeType: 'application/octet-stream' };
}

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

async function resolveFolder(folderName, parentId) {
    const drive = getDrive();

    const searchRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id;
    }

    const createRes = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
    });

    return createRes.data.id;
}

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

async function uploadFile(buffer, fileName, mimeType, options = {}) {
    const drive = getDrive();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!rootFolderId) {
        throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.');
    }

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
        supportsAllDrives: true,
        enforceSingleParent: true,
    });

    const fileId = uploadRes.data.id;
    await setPublicPermission(fileId);

    const fileRes = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, parents',
        supportsAllDrives: true,
    });

    return formatFileResponse(fileRes.data);
}

async function uploadBase64(base64String, options = {}) {
    const { buffer, mimeType } = parseBase64(base64String);
    const fileName = options.name || `upload-${uuidv4()}`;
    return uploadFile(buffer, fileName, mimeType, options);
}

async function uploadFromUrl(url, options = {}) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 100 * 1024 * 1024,
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const mimeType = contentType.split(';')[0].trim();

    const urlPath = new URL(url).pathname;
    const urlFileName = urlPath.split('/').pop() || `download-${uuidv4()}`;
    const fileName = options.name || urlFileName;

    return uploadFile(buffer, fileName, mimeType, options);
}

async function deleteFile(fileId) {
    const drive = getDrive();
    await drive.files.delete({
        fileId,
        supportsAllDrives: true,
    });
    return { fileId, deleted: true };
}

async function getFile(fileId) {
    const drive = getDrive();
    const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, parents',
        supportsAllDrives: true,
    });
    return formatFileResponse(res.data);
}

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
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
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
