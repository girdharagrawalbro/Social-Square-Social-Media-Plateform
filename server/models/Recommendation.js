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
    interestVector: { type: [Number], default: [] }, // aggregated EMA vector
    topCategories: [{ type: String }],
    likedTags: [{ type: String }],
    recentSearches: [{ type: String }],
    lastUpdated: { type: Date, default: Date.now },

    // ─── Behavioral Stats (P5) ──────────────────────────────────────────────
    // Rolling average time (seconds) the user spends viewing a post
    avgDwellTimeSec: { type: Number, default: 0 },
    // Total number of tracked interaction events (used for rolling avg)
    totalInteractions: { type: Number, default: 0 },
    // Content type the user engages with most
    preferredContentType: {
        type: String,
        enum: ['video', 'image', 'text', 'mixed'],
        default: 'mixed'
    },
    // Hours of day (0-23) when user is active (for time-of-day scoring)
    activeHours: { type: [Number], default: [] },
    // Average % of videos the user watches to completion (0-1)
    videoCompletionRate: { type: Number, default: 0 },
    // Categories the user has explicitly marked as "not interested"
    dislikedCategories: [{ type: String }],
    // Interaction counts: video_watch, like, save, share, comment
    videoWatchCount: { type: Number, default: 0 },
    videoCompletionCount: { type: Number, default: 0 },
});

// Index for fast lookups and sorting
UserInterestSchema.index({ lastUpdated: -1 });

const CommentVectorSchema = new mongoose.Schema({
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true, unique: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    vector: { type: [Number], required: true },
    topic: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// ─── Video Stats (P9) ─────────────────────────────────────────────────────────
// Tracks per-reel watch-through metrics for ranking
const VideoStatsSchema = new mongoose.Schema({
    postId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    totalViews:        { type: Number, default: 0 },
    totalWatchTimeSec: { type: Number, default: 0 },
    completionCount:   { type: Number, default: 0 },   // watched ≥80% of video
    avgWatchTimeSec:   { type: Number, default: 0 },
    watchThroughRate:  { type: Number, default: 0 },   // completionCount / totalViews (0-1)
    updatedAt:         { type: Date, default: Date.now }
});
VideoStatsSchema.index({ watchThroughRate: -1 });

const PostVector  = mongoose.model('PostVector',  PostVectorSchema);
const UserInterest = mongoose.model('UserInterest', UserInterestSchema);
const CommentVector = mongoose.model('CommentVector', CommentVectorSchema);
const VideoStats  = mongoose.model('VideoStats',  VideoStatsSchema);

module.exports = { PostVector, UserInterest, CommentVector, VideoStats };
