const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    coverImage: { type: String, default: null }
}, { timestamps: true });

// Ensure collection names are unique per user
CollectionSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Collection', CollectionSchema);
