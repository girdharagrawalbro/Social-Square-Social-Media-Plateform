const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },


    // Media sharing
    media: {
        url: { type: String, default: null },
        type: { type: String, enum: ['image', 'video', 'audio', 'file'], default: null },
        name: { type: String, default: null },
        size: { type: Number, default: null },
    },

    // Reply-to-message
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    // Reactions: { userId → emoji }
    reactions: { type: Map, of: String, default: {} },

    // Edit/delete
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    originalContent: { type: String, default: null },
    deletedAt: { type: Date, default: null }, // soft delete

    isRead: { type: Boolean, default: false },
    storyReply: {
        storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
        mediaUrl: String,
        mediaType: String,
        authorName: String,
        authorUsername: String,
        authorProfilePicture: String,
        isShare: Boolean,
    },
    sharedPost: {
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
        authorName: String,
        authorUsername: String,
        authorProfilePicture: String,
        caption: String,
        mediaUrl: String,
        mediaType: String,
    },
}, { timestamps: true });

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', MessageSchema);