// ─── GOOGLE DRIVE AUTH CONFIG ─────────────────────────────────────────────────
// Uses OAuth2 client for Google Drive API operations in Social Square backend
// ──────────────────────────────────────────────────────────────────────────────

function getAuth() {
    if (_auth) return _auth;
    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    _auth = oauth2Client;
    return _auth;
}

function getDrive() {
    if (_drive) return _drive;
    _drive = google.drive({ version: 'v3', auth: getAuth() });
    return _drive;
}

module.exports = { getAuth, getDrive };
