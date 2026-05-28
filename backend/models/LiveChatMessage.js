const mongoose = require('mongoose');

const LiveChatMessageSchema = new mongoose.Schema({
    streamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LiveStream',
        required: true
    },
    user: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        fullname: { type: String, required: true },
        profile_picture: { type: String }
    },
    text: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

LiveChatMessageSchema.index({ streamId: 1, createdAt: 1 });

module.exports = mongoose.model('LiveChatMessage', LiveChatMessageSchema);
