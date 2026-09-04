const mongoose = require('mongoose');

const accountHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String }, // e.g., 'LOGIN', 'PASSWORD_CHANGED', '2FA_TOGGLED', 'PROFILE_UPDATED'
    details: { type: String },
    ipAddress: { type: String },
}, { timestamps: true });

accountHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AccountHistory', accountHistorySchema);
