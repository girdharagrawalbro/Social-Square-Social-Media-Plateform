const express = require('express');
const router = express.Router();
const axios = require('../utils/http');
const verifyToken = require('../middleware/Verifytoken');

let CLOUDINARY_API_BASE_URL = process.env.CLOUDINARY_API_BASE_URL;

const GDRIVE_API_BASE_URL = process.env.GDRIVE_API_BASE_URL;

/**
 * @route POST /api/media/sign-upload
 * @desc Generate a signature for direct Cloudinary upload (Bypasses proxy bottleneck)
 * @access Private
 */
router.post('/sign-upload', verifyToken, (req, res) => {
    try {
        const timestamp = Math.round(Date.now() / 1000);
        const folder = req.body.folder || `users/${req.userId || 'anonymous'}`;

        // Ask microservice to generate the signature
        return axios.post(`${CLOUDINARY_API_BASE_URL}/sign`, { timestamp, folder })
            .then(response => {
                const data = response.data || {};
                // Only forward safe fields from the signing microservice to clients.
                const safe = {
                    success: data.success === false ? false : true,
                    signature: data.signature,
                    timestamp: data.timestamp,
                    cloudName: data.cloudName,
                    apiKey: data.apiKey,
                    folder: data.folder || folder,
                    message: data.message
                };
                return res.json(safe);
            })
            .catch(err => {
                console.error('[Cloudinary Sign Error]:', err.response?.data || err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Signature generation failed',
                    error: err.response?.data?.message || err.message
                });
            });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route POST /api/media/drive/sign-upload
 * @desc Initiate a resumable upload session for Google Drive
 * @access Private
 */
router.post('/drive/sign-upload', verifyToken, async (req, res) => {
    try {
        // Delegate to Drive microservice to get a resumable session URL
        // The microservice handles the OAuth/ServiceAccount logic
        const response = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/initiate-resumable`, {
            name: req.body.name,
            mimeType: req.body.mimeType,
            folder: req.body.folder
        });

        res.json(response.data);
    } catch (error) {
        console.error('[Drive Sign Error]:', error.message);
        res.status(500).json({ success: false, message: 'Failed to initiate upload' });
    }
});

/**
 * @route POST /api/media/drive/upload-url
 * @desc Proxy remote URL upload to Drive microservice
 * @access Private
 */
router.post('/drive/upload-url', verifyToken, async (req, res) => {
    try {
        const { url, folder, name } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'No URL provided' });

        const response = await axios.post(`${GDRIVE_API_BASE_URL}/api/drive/upload-url`, {
            url, folder, name
        });
        res.status(response.status).json({ success: true });
    } catch (error) {
        console.error('[Drive Upload-URL Error]:', error.message);
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

/**
 * @route DELETE /api/media/drive/delete
 * @desc Proxy file deletion to Drive microservice
 * @access Private
 */
router.delete('/drive/delete', verifyToken, async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ success: false, message: 'No fileId provided' });

        const response = await axios.delete(`${GDRIVE_API_BASE_URL}/api/drive/delete`, {
            data: { fileId }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[Drive Delete Error]:', error.message);
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

/**
 * @route GET /api/media/drive/file/:fileId
 * @desc Proxy metadata retrieval to Drive microservice
 * @access Private
 */
router.get('/drive/file/:fileId', verifyToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const response = await axios.get(`${GDRIVE_API_BASE_URL}/api/drive/file/${fileId}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('[Drive Get-File Error]:', error.message);
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

/**
 * LEGACY / INTERNAL PROXY ROUTES
 * Keep these for AI generation or admin tools that run server-side.
 */

router.post('/upload-base64', verifyToken, async (req, res) => {
    try {
        const { file, folder, resourceType, start_offset, end_offset } = req.body;
        if (!file) return res.status(400).json({ success: false, message: 'No file provided' });

        const response = await axios.post(`${CLOUDINARY_API_BASE_URL}/upload-base64`, {
            file, folder, resourceType, start_offset, end_offset
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

router.post('/upload-url', verifyToken, async (req, res) => {
    try {
        const { url, folder } = req.body;
        if (!url) return res.status(400).json({ success: false, message: 'No URL provided' });

        const response = await axios.post(`${CLOUDINARY_API_BASE_URL}/upload-url`, {
            url, folder
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ success: false, message: error.message });
    }
});

module.exports = router;
