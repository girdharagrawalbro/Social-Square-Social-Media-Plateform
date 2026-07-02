const mongoose = require('mongoose');

/**
 * KnowledgeTree — auto-aggregated topic trees per user.
 * Updated whenever a KnowledgeNote is created/deleted for a user.
 * One document per (userId, topic) pair.
 */
const SubtopicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

const KnowledgeTreeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Top-level topic (matches KnowledgeNote.topic)
    topic: { type: String, required: true },

    // Icon/emoji for this topic (auto-assigned based on category)
    icon: { type: String, default: '📚' },

    // Total notes count under this topic
    noteCount: { type: Number, default: 0 },

    // Breakdown by learning type
    notesCount: { type: Number, default: 0 },
    learningsCount: { type: Number, default: 0 },

    // Subtopic breakdown
    subtopics: [SubtopicSchema],

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique per user+topic
KnowledgeTreeSchema.index({ userId: 1, topic: 1 }, { unique: true });
KnowledgeTreeSchema.index({ userId: 1, noteCount: -1 });

module.exports = mongoose.model('KnowledgeTree', KnowledgeTreeSchema);
