const express = require('express');
const multer = require('multer');
const router = express.Router();
const axios = require('../utils/http');
const verifyToken = require('../middleware/Verifytoken');
const User = require('../models/User');

const UPLOAD_API_BASE_URL = process.env.UPLOAD_API_BASE_URL;

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
                const driveResponse = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload`, {
                    file: base64File,
                    name: req.file.originalname,
                    folder
                });

                if (driveResponse.data && driveResponse.data.success) {
                    const fileData = driveResponse.data.data;
                    return res.status(200).json({
                        success: true,
                        url: fileData.webContentLink || fileData.webViewLink || `https://drive.google.com/file/d/${fileData.fileId}/view`,
                        fileId: fileData.fileId,
                        source: 'drive'
                    });
                }
            } catch (driveErr) {
                console.error('[Drive Direct Upload] Failed:', driveErr.message);
            }
        }

        // Otherwise, attempt Cloudinary upload
        try {
            const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-base64`, {
                file: base64File,
                folder,
                resourceType,
            });

            console.log('[Upload] Cloudinary microservice response:', JSON.stringify(response.data, null, 2));

            const payload = {
                success: response.data.success,
                url: response.data.data.secure_url,
                publicId: response.data.data.public_id,
            };

            return res.status(response.status).json(payload);
        } catch (cloudinaryError) {
            console.warn('[Cloudinary Upload Failed] Falling back to Google Drive:', cloudinaryError.message);
            
            // Fallback to Google Drive
            const driveResponse = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload`, {
                file: base64File,
                name: req.file.originalname,
                folder
            });

            if (driveResponse.data && driveResponse.data.success) {
                const fileData = driveResponse.data.data;
                return res.status(200).json({
                    success: true,
                    url: fileData.webContentLink || fileData.webViewLink || `https://drive.google.com/file/d/${fileData.fileId}/view`,
                    fileId: fileData.fileId,
                    source: 'drive'
                });
            }
            
            throw cloudinaryError; // Re-throw if both failed
        }
    } catch (error) {
        console.error('[Upload] proxy error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Something went wrong. Please try again.',
        });
    }
});

router.post('/upload-base64', verifyToken, async (req, res) => {
    try {
        const { file, resourceType, start_offset, end_offset } = req.body;
        if (!file) return res.status(400).json({ success: false, message: 'No file provided' });
        const folder = await getStandardizedFolder(req);

        const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-base64`, {
            file, folder, resourceType, start_offset, end_offset
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

router.post('/upload-url', verifyToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'No URL provided' });
        const folder = await getStandardizedFolder(req);

        const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-url`, {
            url, folder
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

const GDRIVE_API_BASE_URL = process.env.GDRIVE_API_BASE_URL || 'https://gdrive-lr06.onrender.com';

// ─── GOOGLE DRIVE FALLBACK API ────────────────────────────────────────────────
router.post('/drive/upload', verifyToken, async (req, res) => {
    try {
        const { file, name, folder } = req.body;
        if (!file) return res.status(400).json({ success: false, message: 'No file provided' });

        const response = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload`, {
            file, name, folder
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[Drive Upload Proxy Error]:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || error.message
        });
    }
});

router.post('/drive/upload-url', verifyToken, async (req, res) => {
    try {
        const { url, folder, name } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'No URL provided' });

        const response = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload-url`, {
            url, folder, name
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[Drive Upload URL Proxy Error]:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || error.message
        });
    }
});

router.get('/drive/file/:fileId', verifyToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const response = await axios.get(`${GDRIVE_API_BASE_URL}/api/drive/file/${fileId}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[Drive Get File Proxy Error]:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || error.message
        });
    }
});

module.exports = router;