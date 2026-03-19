const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
    event: { type: String, required: true }, // e.g. 'post.created'
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    category: { type: String },
    meta: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analytics', AnalyticsSchema);