require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*';
const allowedOrigins = rawCorsOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*');

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// ─── BODY PARSING ───────────────────────────────────────────────────────────
// No body size limit — Google Drive has no meaningful per-file cap.
// Large base64 uploads (e.g. multi-GB files) are supported.
app.use(express.json({ limit: '10gb' }));
app.use(express.urlencoded({ extended: true, limit: '10gb' }));

// ─── ROUTES ─────────────────────────────────────────────────────────────────
const driveRoutes = require('./routes/drive.routes');
app.use('/api/drive', driveRoutes);

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/ping', (_req, res) => res.status(200).json({
    status: 'ok',
    message: 'pong',
    service: 'DriveStore — Google Drive Upload Service',
}));

// ─── 404 HANDLER ────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[DriveStore] Unhandled error:', err.message);

    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'File too large. Maximum allowed size is 100 MB.',
        });
    }

    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ─── START SERVER ────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 5002);

app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║       DriveStore — Google Drive Service      ║');
    console.log(`  ║     Running on http://localhost:${PORT}         ║`);
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Endpoints:');
    console.log('    POST   /api/drive/upload        (multipart or base64)');
    console.log('    POST   /api/drive/upload-url    (from remote URL)');
    console.log('    DELETE /api/drive/delete        (by fileId)');
    console.log('    GET    /api/drive/file/:fileId  (metadata)');
    console.log('    GET    /api/drive/list          (list files)');
    console.log('    GET    /ping                    (health check)');
    console.log('');

    // ─── Self-ping keep-alive (Render free-tier) ───────────────────────────
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
    setInterval(async () => {
        try {
            const axios = require('axios');
            const url = (process.env.GDRIVE_SERVICE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
            await axios.get(`${url}/ping`);
            console.log(`[Self-Ping] Keep-alive sent to ${url}/ping`);
        } catch (err) {
            console.error('[Self-Ping] Error:', err.message);
        }
    }, PING_INTERVAL);
});
