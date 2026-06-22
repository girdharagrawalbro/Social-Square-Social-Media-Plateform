const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  cheers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const GoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  targetDate: { type: Date, required: true },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
  milestones: [MilestoneSchema],
  cheers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Index for fetching a user's goals quickly
GoalSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Goal', GoalSchema);
