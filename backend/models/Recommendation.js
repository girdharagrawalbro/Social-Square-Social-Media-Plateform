const mongoose = require('mongoose');

// Stores embeddings for posts to avoid re-generating them
const PostVectorSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    vector: { type: [Number], required: true }, // [0.1, 0.44, ...]
    category: { type: String },
    tags: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

// Stores the aggregated interest profile for each user
const UserInterestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    interestVector: { type: [Number], default: [] }, // aggregated vector
    topCategories: [{ type: String }],
    likedTags: [{ type: String }],
    recentSearches: [{ type: String }],
    lastUpdated: { type: Date, default: Date.now }
});

const PostVector = mongoose.model('PostVector', PostVectorSchema);
const UserInterest = mongoose.model('UserInterest', UserInterestSchema);

module.exports = { PostVector, UserInterest };
