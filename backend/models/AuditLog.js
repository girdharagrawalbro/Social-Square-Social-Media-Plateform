const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  action: { type: String, required: true }, // e.g., 'privacy_toggle', 'AUTOMATED_MODERATION'
  targetType: { type: String }, // e.g., 'user', 'post', 'comment', 'report', 'system'
  targetId: { type: mongoose.Schema.Types.Mixed }, // String or ObjectId
  targetSnapshot: { type: mongoose.Schema.Types.Mixed },
  meta: { type: mongoose.Schema.Types.Mixed },
  metadata: {
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    reason: String
  },
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
