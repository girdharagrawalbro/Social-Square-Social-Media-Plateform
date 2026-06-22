const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
    {
        user: {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            fullname: { type: String, required: true },
            profile_picture: { type: String },
        },
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
        content: { type: String, required: true },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
        replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

        // ─── SMART DISCUSSION FIELDS ──────────────────────────────────────────────
        isBestAnswer: { type: Boolean, default: false },
        isInsightful: { type: Boolean, default: false },
        quality: { type: String, enum: ['high', 'normal', 'low'], default: 'normal' },
        topic: { type: String, default: 'General' },
        feedbackDetails: {
            strengths: { type: String, default: null },
            improvements: { type: String, default: null },
            rating: { type: Number, min: 1, max: 5, default: null }
        },

        // ─── MODERATION FIELDS ────────────────────────────────────────────────────
        isVisible: { type: Boolean, default: true, index: true },
        isFlagged: { type: Boolean, default: false, index: true },
        moderationScore: { type: Number, default: 0 },
        moderationReason: { type: String, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);