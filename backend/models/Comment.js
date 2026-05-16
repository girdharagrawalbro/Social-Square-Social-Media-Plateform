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

        // ─── MODERATION FIELDS ────────────────────────────────────────────────────
        isVisible: { type: Boolean, default: true, index: true },
        isFlagged: { type: Boolean, default: false, index: true },
        moderationScore: { type: Number, default: 0 },
        moderationReason: { type: String, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);