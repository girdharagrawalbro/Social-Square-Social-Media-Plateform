const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true }, // e.g., 'privacy_toggle'
  metadata: {
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    reason: String
  },
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
