const express = require('express');
const multer = require('multer');
const router = express.Router();
const axios = require('../utils/http');
const verifyToken = require('../middleware/Verifytoken');
const User = require('../models/User');
const driveService = require('../services/drive.service');
const {
    uploadBase64,
    uploadFromUrl,
    generateSignature
} = require('../services/cloudinary.service');

const UPLOAD_API_BASE_URL = process.env.UPLOAD_API_BASE_URL;
const GDRIVE_API_BASE_URL = process.env.GDRIVE_API_BASE_URL;

const IMAGE_MAX = 20 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;

// Buffer in memory is fine for images; for 100MB video at scale consider
// multer.diskStorage + fs stream instead of memoryStorage.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: VIDEO_MAX } });

async function getStandardizedFolder(req) {
    let userFolder = req.userId || 'anonymous';
    if (req.userId) {
        try {
            const user = await User.findById(req.userId).select('username').lean();
            if (user?.username) userFolder = `${req.userId}-${user.username}`;
        } catch (err) {
            console.error('Error fetching user for folder name:', err);
        }
    }
    let folderType = (req.body.folder || 'misc').replace(/\.\./g, '').replace(/^\/+/, '');
    return `SocialSquare/${userFolder}/${folderType || 'misc'}`;
}

// Helper to extract a human-readable error string, sanitizing HTML status pages (e.g., 503 "Service Suspended")
function getCleanErrorMessage(error) {
    if (error.response?.data) {
        if (typeof error.response.data === 'string') {
            if (error.response.data.includes('This service has been suspended')) {
                return `External upload microservice suspended (HTTP ${error.response.status || 503})`;
            }
            if (error.response.data.includes('<html') || error.response.data.includes('<!DOCTYPE')) {
                return `External upload microservice returned HTTP ${error.response.status || 500} error page`;
            }
            return error.response.data;
        }
        if (error.response.data.message) {
            return error.response.data.message;
        }
    }
    return error.message || 'Upload failed';
}

// Priority #1: Local server Google Drive service. Priority #2: External microservice.
async function performDriveUpload(fileData, fileName, folder) {
    // 1. Try local server in-process driveService FIRST
    try {
        return await driveService.uploadBase64(fileData, { name: fileName, folder });
    } catch (inProcessErr) {
        console.warn('[In-Process Google Drive Upload Failed]:', inProcessErr.message);
        
        // 2. Fall back to external microservice if configured
        if (GDRIVE_API_BASE_URL) {
            console.warn('Falling back to Google Drive microservice...');
            try {
                const driveResponse = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload`, {
                    file: fileData,
                    name: fileName,
                    folder
                });
                if (driveResponse.data && driveResponse.data.success) {
                    return driveResponse.data.data;
                }
                throw new Error(driveResponse.data?.message || 'Drive microservice upload failed');
            } catch (microserviceErr) {
                const cleanMsg = getCleanErrorMessage(microserviceErr);
                console.error('[Drive Microservice Upload Failed]:', cleanMsg);
                throw new Error(cleanMsg);
            }
        }
        
        throw inProcessErr;
    }
}

// Priority #1: Local server Cloudinary service. Priority #2: External microservice.
async function performCloudinaryUpload(fileData, folder, resourceType) {
    // 1. Try local server in-process Cloudinary upload FIRST
    try {
        return await uploadBase64(fileData, { folder, resource_type: resourceType });
    } catch (inProcessErr) {
        console.warn('[In-Process Cloudinary Upload Failed]:', inProcessErr.message);

        // 2. Fall back to external microservice if configured
        if (UPLOAD_API_BASE_URL) {
            console.warn('Falling back to Cloudinary upload microservice...');
            try {
                const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-base64`, {
                    file: fileData,
                    folder,
                    resourceType,
                });
                if (response.data && response.data.data) {
                    return response.data.data;
                }
                if (response.data && response.data.public_id) {
                    return response.data;
                }
            } catch (microserviceErr) {
                const cleanMsg = getCleanErrorMessage(microserviceErr);
                console.warn(`[Cloudinary Microservice Failed: ${cleanMsg}]`);
            }
        }

        throw inProcessErr;
    }
}

router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        const folder = await getStandardizedFolder(req);
        const resourceType = req.body.resourceType === 'video' ? 'video' : (req.body.resourceType || 'auto');
        const limit = resourceType === 'video' ? VIDEO_MAX : IMAGE_MAX;

        if (req.file.size > limit) {
            return res.status(400).json({ success: false, message: 'size limit exceeded' });
        }

        const base64File = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        // If generic non-media file, route directly to Google Drive
        const isGenericFile = !req.file.mimetype.startsWith('image/') &&
            !req.file.mimetype.startsWith('video/') &&
            !req.file.mimetype.startsWith('audio/');

        if (isGenericFile) {
            try {
                const fileData = await performDriveUpload(base64File, req.file.originalname, folder);
                return res.status(200).json({
                    success: true,
                    url: fileData.webContentLink || fileData.webViewLink || `https://drive.google.com/file/d/${fileData.fileId}/view`,
                    fileId: fileData.fileId,
                    source: 'drive'
                });
            } catch (driveErr) {
                console.error('[Drive Direct Upload] Failed:', driveErr.message);
                return res.status(500).json({
                    success: false,
                    message: `Generic file upload failed: ${driveErr.message}`
                });
            }
        }

        // Direct Cloudinary Upload (local server first, microservice second)
        try {
            const resultData = await performCloudinaryUpload(base64File, folder, resourceType);

            console.log('[Upload] Cloudinary success:', resultData.public_id);

            return res.status(200).json({
                success: true,
                url: resultData.secure_url,
                publicId: resultData.public_id,
                data: resultData
            });
        } catch (cloudinaryError) {
            console.warn('[Cloudinary Upload Failed] Falling back to Google Drive:', cloudinaryError.message);

            try {
                const fileData = await performDriveUpload(base64File, req.file.originalname, folder);
                return res.status(200).json({
                    success: true,
                    url: fileData.webContentLink || fileData.webViewLink || `https://drive.google.com/file/d/${fileData.fileId}/view`,
                    fileId: fileData.fileId,
                    source: 'drive'
                });
            } catch (driveErr) {
                console.error('[Google Drive Fallback Failed]:', driveErr.message);
                throw new Error(`Upload failed on all services. Cloudinary: ${cloudinaryError.message} | Drive: ${driveErr.message}`);
            }
        }
    } catch (error) {
        const cleanMessage = getCleanErrorMessage(error);
        console.error('[Upload] error:', cleanMessage);
        res.status(error.response?.status || 500).json({
            success: false,
            message: cleanMessage,
        });
    }
});

router.post('/upload-base64', verifyToken, async (req, res) => {
    try {
        const { file, resourceType, start_offset, end_offset } = req.body;
        if (!file) return res.status(400).json({ success: false, message: 'No file provided' });
        const folder = await getStandardizedFolder(req);

        let data;
        // Priority #1: Local server in-process Cloudinary
        try {
            const result = await uploadBase64(file, { folder, resource_type: resourceType || 'auto', start_offset, end_offset });
            data = { success: true, data: result };
        } catch (inProcessErr) {
            console.warn('[In-process upload-base64 failed]:', inProcessErr.message);
            if (UPLOAD_API_BASE_URL) {
                console.warn('Falling back to upload microservice for base64...');
                const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-base64`, {
                    file, folder, resourceType, start_offset, end_offset
                });
                data = response.data;
            } else {
                throw inProcessErr;
            }
        }
        res.status(200).json(data);
    } catch (error) {
        const cleanMessage = getCleanErrorMessage(error);
        res.status(error.response?.status || 500).json({ success: false, message: cleanMessage });
    }
});

router.post('/upload-url', verifyToken, async (req, res) => {
    try {
        const { url, resourceType } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'No URL provided' });
        const folder = await getStandardizedFolder(req);

        let data;
        // Priority #1: Local server in-process Cloudinary
        try {
            const result = await uploadFromUrl(url, { folder, resource_type: resourceType || 'image' });
            data = { success: true, data: result };
        } catch (inProcessErr) {
            console.warn('[In-process upload-url failed]:', inProcessErr.message);
            if (UPLOAD_API_BASE_URL) {
                console.warn('Falling back to upload microservice for URL...');
                const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-url`, {
                    url, folder, resourceType
                });
                data = response.data;
            } else {
                throw inProcessErr;
            }
        }
        res.status(200).json(data);
    } catch (error) {
        const cleanMessage = getCleanErrorMessage(error);
        res.status(error.response?.status || 500).json({ success: false, message: cleanMessage });
    }
});

router.post('/sign', verifyToken, async (req, res) => {
    try {
        const { timestamp, folder } = req.body;
        if (!timestamp) {
            return res.status(400).json({ success: false, message: 'Timestamp is required' });
        }
        const userFolder = await getStandardizedFolder(req);
        const result = generateSignature(timestamp, folder || userFolder);
        res.status(200).json(result);
    } catch (error) {
        console.error('Signature Generation Error:', getCleanErrorMessage(error));
        res.status(500).json({ success: false, message: getCleanErrorMessage(error) });
    }
});

// ─── GOOGLE DRIVE API ─────────────────────────────────────────────────────────
router.post('/drive/upload', verifyToken, async (req, res) => {
    try {
        const { file, name, folder } = req.body;
        if (!file) return res.status(400).json({ success: false, message: 'No file provided' });

        const fileData = await performDriveUpload(file, name, folder);
        res.status(200).json({ success: true, data: fileData });
    } catch (error) {
        const cleanMessage = getCleanErrorMessage(error);
        console.error('[Drive Upload Error]:', cleanMessage);
        res.status(error.response?.status || 500).json({
            success: false,
            message: cleanMessage
        });
    }
});

router.post('/drive/upload-url', verifyToken, async (req, res) => {
    try {
        const { url, folder, name } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'No URL provided' });

        let data;
        // Priority #1: Local server in-process Drive
        try {
            const fileData = await driveService.uploadFromUrl(url, { folder, name });
            data = { success: true, data: fileData };
        } catch (inProcessErr) {
            console.warn('[In-process Drive uploadFromUrl failed]:', inProcessErr.message);
            if (GDRIVE_API_BASE_URL) {
                console.warn('Falling back to Drive microservice for upload-url...');
                const response = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload-url`, { url, folder, name });
                data = response.data;
            } else {
                throw inProcessErr;
            }
        }
        res.status(200).json(data);
    } catch (error) {
        const cleanMessage = getCleanErrorMessage(error);
        console.error('[Drive Upload URL Error]:', cleanMessage);
        res.status(error.response?.status || 500).json({
            success: false,
            message: cleanMessage
        });
    }
});

router.get('/drive/file/:fileId', verifyToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        let data;
        // Priority #1: Local server in-process Drive
        try {
            const fileData = await driveService.getFile(fileId);
            data = { success: true, data: fileData };
        } catch (inProcessErr) {
            console.warn('[In-process Drive getFile failed]:', inProcessErr.message);
            if (GDRIVE_API_BASE_URL) {
                console.warn('Falling back to Drive microservice for getFile...');
                const response = await axios.get(`${GDRIVE_API_BASE_URL}/api/drive/file/${fileId}`);
                data = response.data;
            } else {
                throw inProcessErr;
            }
        }
        res.status(200).json(data);
    } catch (error) {
        const cleanMessage = getCleanErrorMessage(error);
        console.error('[Drive Get File Error]:', cleanMessage);
        res.status(error.response?.status || 500).json({
            success: false,
            message: cleanMessage
        });
    }
});

module.exports = router;