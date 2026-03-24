const mongoose = require('mongoose');

const AiUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['text', 'image'], required: true, index: true },
  },
  {
    timestamps: true,
  }
);

AiUsageSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AiUsage', AiUsageSchema);
