const mongoose = require('mongoose');

const LoginSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Token family for reuse detection
    tokenFamily: { type: String, required: true }, // unique per login session
    refreshToken: { type: String, required: true }, // hashed
    isRevoked: { type: Boolean, default: false },

    // Browser fingerprint
    fingerprint: { type: String, required: true }, // hashed

    // Device & location info
    ip: { type: String },
    userAgent: { type: String },
    device: { type: String },  // e.g. "Chrome on Windows"
    location: {
        city: { type: String },
        region: { type: String },
        country: { type: String },
    },

    // Alert tracking
    isNewDevice: { type: Boolean, default: false },
    alertSent: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
});

// Auto-delete expired sessions
LoginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginSession', LoginSessionSchema);