const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    emoji: { type: String, required: true },
}, { timestamps: true });

reactionSchema.index({ userId: 1, postId: 1 }, { unique: true });
reactionSchema.index({ postId: 1 });

module.exports = mongoose.model('Reaction', reactionSchema);
