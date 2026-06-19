const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
    user: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        fullname: { type: String, required: true },
        profile_picture: { type: String },
    },
    media: {
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], required: true },
        thumbnailUrl: { type: String, default: null },
    },
    text: {
        content: { type: String, default: null },
        color: { type: String, default: '#ffffff' },
        position: { type: String, default: 'center' }, // top, center, bottom
    },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    visibility: { type: String, enum: ['public', 'followers', 'close_friends'], default: 'public' },
    sharedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    sharedStoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', default: null },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        // Removed TTL index so documents are soft-deleted (kept in DB but expired)
    },
}, { timestamps: true });

module.exports = mongoose.model('Story', StorySchema);