// ─── GOOGLE DRIVE ROUTES ──────────────────────────────────────────────────────
// All endpoints mirror the Cloudinary microservice API shape.
// Response format: { success: true, data: {...} } | { success: false, message: "..." }
// ──────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');

const {
    uploadFile,
    uploadBase64,
    uploadFromUrl,
    deleteFile,
    getFile,
    listFiles,
} = require('../services/drive.service');

// ─────────────────────────────────────────────────────────────────────────────
// ✅  POST /api/drive/upload
//
// Universal upload endpoint — handles BOTH:
//   1. multipart/form-data  →  field: "file"  (images, videos, PDFs, any type)
//   2. application/json     →  body: { "file": "data:image/png;base64,..." }
//
// Optional body/query params:
//   folder  (string)  — name of sub-folder inside root Drive folder
//   name    (string)  — override the stored filename
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        let result;

        if (req.file) {
            // ── multipart/form-data upload ──────────────────────────────────
            const { folder, name } = req.body;
            result = await uploadFile(
                req.file.buffer,
                name || req.file.originalname,
                req.file.mimetype,
                { folder, name }
            );

        } else if (req.body && req.body.file) {
            // ── JSON base64 upload ──────────────────────────────────────────
            const { file, folder, name } = req.body;
            result = await uploadBase64(file, { folder, name });

        } else {
            return res.status(400).json({
                success: false,
                message: 'No file provided. Send multipart/form-data with a "file" field, or JSON with { "file": "data:...;base64,..." }.',
            });
        }

        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error('[DriveStore] Upload Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// ✅  POST /api/drive/upload-url
//
// Downloads a remote file from a public URL and uploads it to Google Drive.
//
// Body:
//   url     (string, required)  — public URL of the file to upload
//   folder  (string, optional)  — sub-folder name
//   name    (string, optional)  — override stored filename
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload-url', async (req, res) => {
    try {
        const { url, folder, name } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, message: 'url is required' });
        }

        const result = await uploadFromUrl(url, { folder, name });

        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error('[DriveStore] Upload-URL Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// ✅  DELETE /api/drive/delete
//
// Permanently deletes a file from Google Drive.
//
// Body:
//   fileId  (string, required)  — Google Drive file ID
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/delete', async (req, res) => {
    try {
        const { fileId } = req.body;

        if (!fileId) {
            return res.status(400).json({ success: false, message: 'fileId is required' });
        }

        const result = await deleteFile(fileId);

        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error('[DriveStore] Delete Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// ✅  GET /api/drive/file/:fileId
//
// Fetches metadata for a single Drive file.
//
// Params:
//   fileId  (string, required)  — Google Drive file ID
// ─────────────────────────────────────────────────────────────────────────────
router.get('/file/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({ success: false, message: 'fileId is required' });
        }

        const result = await getFile(fileId);

        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error('[DriveStore] Get File Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// ✅  GET /api/drive/list
//
// Lists files inside a Drive folder.
//
// Query params:
//   folderId    (string)  — Drive folder ID (defaults to root env folder)
//   pageSize    (number)  — max results, 1-100 (default 20)
//   pageToken   (string)  — pagination token from previous response
// ─────────────────────────────────────────────────────────────────────────────
router.get('/list', async (req, res) => {
    try {
        const { folderId, pageSize = 20, pageToken } = req.query;

        const result = await listFiles(folderId || null, Number(pageSize), pageToken || null);

        res.status(200).json({
            success: true,
            data: result.files,
            nextPageToken: result.nextPageToken,
        });

    } catch (error) {
        console.error('[DriveStore] List Files Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


module.exports = router;
