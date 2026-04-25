// ─── GOOGLE DRIVE AUTH CONFIG ─────────────────────────────────────────────────
// Uses a Service Account for server-to-server authentication.
// No user OAuth flow needed — just share the Drive folder with the SA email.
// ──────────────────────────────────────────────────────────────────────────────

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let _auth = null;
let _drive = null;

/**
 * Returns a cached, authenticated Google Auth client.
 * Reads the service account JSON key from GOOGLE_SERVICE_ACCOUNT_KEY_PATH.
 */
function getAuth() {
    if (_auth) return _auth;

    const keyPath = path.resolve(
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account.json'
    );

    if (!fs.existsSync(keyPath)) {
        throw new Error(
            `[DriveStore] Service account key not found at: ${keyPath}\n` +
            'Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH in your .env file.\n' +
            'See .env.example for full setup instructions.'
        );
    }

    const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

    _auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return _auth;
}

/**
 * Returns a cached Google Drive v3 client.
 */
function getDrive() {
    if (_drive) return _drive;
    _drive = google.drive({ version: 'v3', auth: getAuth() });
    return _drive;
}

module.exports = { getAuth, getDrive };
