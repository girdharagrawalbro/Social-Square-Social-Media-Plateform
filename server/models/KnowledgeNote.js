const mongoose = require('mongoose');

/**
 * KnowledgeNote — stores a user's saved post converted into a note/learning item.
 * Created when a user clicks "Save as Note" or "Save as Learning" on any post.
 */
const KnowledgeNoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Source post (null for manually created notes)
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },

    // Distinguishes a quick save ('note') from an intentional learning ('learning')
    type: {
      type: String,
      enum: ['note', 'learning'],
      default: 'note',
    },

    // Auto-extracted from post caption or user-written title
    title: { type: String, maxLength: 200, default: '' },

    // User's own written content (overrides AI summary if provided)
    content: { type: String, maxLength: 5000, default: '' },

    // Snapshot of original post caption at time of saving
    originalCaption: { type: String, default: '' },

    // Gemini-generated 2–3 sentence summary of the post
    aiSummary: { type: String, default: '' },

    // User's personal highlight / comment on the saved note
    annotation: { type: String, maxLength: 1000, default: '' },

    // Auto-tagged from post category (matches Post.category)
    topic: { type: String, default: 'General', index: true },

    // Finer-grained subtopic (from post tags or AI inference)
    subtopic: { type: String, default: '' },

    // Tags inherited from source post + any user additions
    tags: [{ type: String }],

    // Whether the user has made this note publicly visible
    isPublic: { type: Boolean, default: false },

    // Tracks origin
    sourceType: {
      type: String,
      enum: ['post', 'manual'],
      default: 'post',
    },

    // Soft delete
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound indexes for the most common queries
KnowledgeNoteSchema.index({ userId: 1, topic: 1, createdAt: -1 });
KnowledgeNoteSchema.index({ userId: 1, type: 1, createdAt: -1 });
KnowledgeNoteSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
KnowledgeNoteSchema.index({ postId: 1 });

module.exports = mongoose.model('KnowledgeNote', KnowledgeNoteSchema);
