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

        const response = await axios.post(`${UPLOAD_API_BASE_URL}/upload-base64`, {
            file: base64File,
            folder,
            resourceType,
        });

        console.log('[Upload] microservice response:', JSON.stringify(response.data, null, 2));

        const payload = {
            success: response.data.success,
            url: response.data.data.secure_url,
            publicId: response.data.data.public_id,
        };

        return res.status(response.status).json(payload);
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

module.exports = router;