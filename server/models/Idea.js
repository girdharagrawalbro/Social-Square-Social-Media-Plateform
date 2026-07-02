const mongoose = require('mongoose');

const IdeaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  killedReason: { type: String, required: true },
  lessonsLearned: { type: String, default: '' },
  tags: [{ type: String }],
  status: { type: String, default: 'abandoned' }
}, { timestamps: true });

// Index for fetching user's killed ideas quickly
IdeaSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Idea', IdeaSchema);
