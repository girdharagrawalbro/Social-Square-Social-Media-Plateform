const mongoose = require('mongoose');
 
const FeedSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner of the feed
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    createdAt: { type: Date, default: Date.now },
});
 
FeedSchema.index({ userId: 1, createdAt: -1 }); // fast feed queries
 
module.exports = mongoose.model('Feed', FeedSchema);
 