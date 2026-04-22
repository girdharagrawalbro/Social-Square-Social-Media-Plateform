const express = require('express');
const router = express.Router();

const {
    uploadBase64,
    uploadFromUrl,
    deleteAsset,
    transformUrl
} = require('../services/cloudinary.service'); // adjust path

// ─────────────────────────────────────────────
// ✅ Upload Base64 Image
// POST /api/cloudinary/upload-base64
// ─────────────────────────────────────────────
router.post('/upload-base64', async (req, res) => {
    try {
        const { file, folder, resourceType, ...rest } = req.body;

        if (!file) {
            return res.status(400).json({ success: false, message: 'File (base64) is required' });
        }

        const result = await uploadBase64(file, { folder, resource_type: resourceType || 'image', ...rest });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Upload Base64 Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────
// ✅ Upload from URL
// POST /api/cloudinary/upload-url
// ─────────────────────────────────────────────
router.post('/upload-url', async (req, res) => {
    try {
        const { url, folder, resourceType } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        const result = await uploadFromUrl(url, { folder, resource_type: resourceType || 'image' });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Upload URL Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────
// ✅ Delete Asset
// DELETE /api/cloudinary/delete
// ─────────────────────────────────────────────
router.delete('/delete', async (req, res) => {
    try {
        const { publicId, resourceType } = req.body;

        if (!publicId) {
            return res.status(400).json({ success: false, message: 'publicId is required' });
        }

        const result = await deleteAsset(publicId, resourceType);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────
// ✅ Get Transformed URL
// GET /api/cloudinary/transform
// ─────────────────────────────────────────────
router.get('/transform', (req, res) => {
    try {
        const { publicId, width, height, crop } = req.query;

        if (!publicId) {
            return res.status(400).json({ success: false, message: 'publicId is required' });
        }

        const url = transformUrl(publicId, {
            width,
            height,
            crop: crop || 'fill'
        });

        res.json({
            success: true,
            url
        });

    } catch (error) {
        console.error('Transform Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'publicId is required'
            });
        }

        const cld = require('../services/cloudinary.service').getCloudinary();

        const result = await cld.api.resource(publicId);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get Asset Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


router.get('/', async (req, res) => {
    try {
        const { folder = 'uploads', max_results = 10 } = req.query;

        const cld = require('../services/cloudinary.service').getCloudinary();

        const result = await cld.api.resources({
            type: 'upload',
            prefix: folder,
            max_results: Number(max_results),
        });

        res.json({
            success: true,
            data: result.resources
        });

    } catch (error) {
        console.error('List Assets Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
module.exports = router;