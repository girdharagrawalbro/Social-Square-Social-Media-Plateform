const mongoose = require('mongoose');

const LoginSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Token family for reuse detection
    tokenFamily: { type: String, required: true }, // unique per login session
    accessToken: { type: String, required: true }, // hashed
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
    updatedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
});

// ─── INDEXES ───────────────────────────────────────────────────────────────────
// Critical: fast lookup on every login and refresh (compound on userId + fingerprint)
LoginSessionSchema.index({ userId: 1, fingerprint: 1 });
// Critical: fast revoke-all queries (scoped to a user's active sessions)
LoginSessionSchema.index({ userId: 1, isRevoked: 1 });
// Token lookups by the middleware on every authenticated request
LoginSessionSchema.index({ accessToken: 1 });
LoginSessionSchema.index({ refreshToken: 1 });
// TTL index: MongoDB auto-deletes expired sessions at the document level
LoginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast lookup for token rotation
LoginSessionSchema.index({ tokenFamily: 1 });

// Auto-set updatedAt on every save/update
LoginSessionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
LoginSessionSchema.pre(['updateOne', 'findOneAndUpdate', 'findByIdAndUpdate', 'updateMany'], function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

module.exports = mongoose.model('LoginSession', LoginSessionSchema);