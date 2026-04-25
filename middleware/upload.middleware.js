// ─── MULTER UPLOAD MIDDLEWARE ──────────────────────────────────────────────────
// Memory storage — files are held in buffer, never written to disk.
// Accepts ALL MIME types — images, videos, PDFs, ZIPs, docs, archives, anything.
// NO file size limit — Google Drive storage is effectively unlimited.
// ──────────────────────────────────────────────────────────────────────────────

const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (_req, _file, cb) => {
    // Accept every MIME type — Drive handles them all
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    // No limits — Drive has no meaningful cap per file
});

module.exports = upload;
