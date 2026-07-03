const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const { PostVector, UserInterest, CommentVector } = require("../models/Recommendation");
const { getEmbedding } = require("../utils/embeddings");

/**
 * Gracefully handles recommendation logic locally without external Python dependency.
 * If data is missing (e.g. no vectors), it fails back to sensible defaults.
 */

async function getRecommendedPosts(userId) {
    try {
        // This is primarily handled in routes/recommendation.js now, 
        // but providing a service implementation for consistency.
        const interest = await UserInterest.findOne({ userId }).lean();
        // FIX: userId is a string — cast to ObjectId for proper $ne comparison
        let selfObjectId;
        try { selfObjectId = new mongoose.Types.ObjectId(userId); } catch { selfObjectId = null; }
        const candidates = await Post.find({
            ...(selfObjectId ? { "user._id": { $ne: selfObjectId } } : {}),
            isAnonymous: { $ne: true },
            isVisible: { $ne: false },
            deletedAt: null
        }).sort({ createdAt: -1 }).limit(50).lean();

        if (!interest || !interest.interestVector || interest.interestVector.length === 0) {
            return candidates.slice(0, 20);
        }

        const userVec = interest.interestVector;
        const postVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } }).lean();
        const vecMap = new Map(postVecs.map(v => [v.postId.toString(), v.vector]));

        const ranked = candidates.map(post => {
            const postVec = vecMap.get(post._id.toString());
            let similarity = 0;
            if (postVec) {
                const dotProduct = userVec.reduce((sum, val, i) => sum + val * (postVec[i] || 0), 0);
                similarity = dotProduct; // Simplified similarity
            }
            return { post, score: similarity };
        });

        ranked.sort((a, b) => b.score - a.score);
        return ranked.slice(0, 20).map(r => r.post);
    } catch (err) {
        console.error("[RecommendationService] getRecommendedPosts error:", err.message);
        return [];
    }
}

async function getRecommendedUsers(userId) {
    try {
        // FIX: Cast userId string to ObjectId for proper $ne comparison
        let selfObjectId;
        try { selfObjectId = new mongoose.Types.ObjectId(userId); } catch { selfObjectId = null; }

        const interest = await UserInterest.findOne({ userId }).lean();
        if (!interest || !interest.topCategories.length) {
            // Fallback: Suggest active users
            return await User.find({
                ...(selfObjectId ? { _id: { $ne: selfObjectId } } : {}),
                isBanned: false,
                deletedAt: null
            })
                .sort({ lastSeen: -1 })
                .limit(5)
                .select('fullname username profile_picture isOnline')
                .lean();
        }

        // Find users with overlapping top categories
        const suggested = await User.find({
            ...(selfObjectId ? { _id: { $ne: selfObjectId } } : {}),
            isBanned: false,
            deletedAt: null
        })
            .limit(20)
            .select('fullname username profile_picture isOnline')
            .lean();

        return suggested.slice(0, 5);
    } catch (err) {
        console.error("[RecommendationService] getRecommendedUsers error:", err.message);
        return [];
    }
}

async function getSimilarPosts(postId) {
    try {
        const targetPost = await Post.findById(postId).lean();
        if (!targetPost) return [];

        const similar = await Post.find({
            _id: { $ne: postId },
            category: targetPost.category,
            isAnonymous: { $ne: true },
            isVisible: { $ne: false },
            deletedAt: null
        }).sort({ createdAt: -1 }).limit(10)
            .select('_id caption image_urls video videoThumbnail category user createdAt mediaKeys videoKey videoIv voiceNoteKey voiceNoteIv')
            .lean();

        return similar;
    } catch (err) {
        console.error("[RecommendationService] getSimilarPosts error:", err.message);
        return [];
    }
}

async function getPersonalizedTrending(userId) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return await Post.find({
            isAnonymous: { $ne: true },
            isVisible: { $ne: false },
            deletedAt: null,
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ score: -1, views: -1 }).limit(10)
            .select('_id caption image_urls video videoThumbnail category user createdAt score views mediaKeys videoKey videoIv voiceNoteKey voiceNoteIv')
            .lean();
    } catch (err) {
        console.error("[RecommendationService] getPersonalizedTrending error:", err.message);
        return [];
    }
}

async function getPersonalizedSearch(userId, q, restrictedIds = [], typeFilter = 'all') {
    try {
        if (!q) return [];
        // FIX: restrictedIds are strings — cast to ObjectIds for proper $nin matching against user._id (ObjectId)
        const restrictedObjectIds = restrictedIds
            .map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
            .filter(Boolean);

        // 1. Generate Embedding for query
        const queryVector = await getEmbedding(q);
        
        if (typeFilter === 'comments') {
            if (!queryVector || queryVector.length === 0) return [];
            
            // Search Comments Vector
            const commentVecs = await CommentVector.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index", // Requires vector index on CommentVector in Atlas
                        path: "vector",
                        queryVector: queryVector,
                        numCandidates: 100,
                        limit: 20
                    }
                }
            ]);
            
            const commentIds = commentVecs.map(cv => cv.commentId);
            const Comment = require("../models/Comment");
            const comments = await Comment.find({ _id: { $in: commentIds }, isVisible: { $ne: false } })
                .populate('user', 'fullname profile_picture')
                .lean();
                
            return comments.map(c => ({ ...c, type: 'comment' }));
        }

        // Search Posts Vector
        let postIds = [];
        if (queryVector && queryVector.length > 0) {
            let prefilter = {};
            if (typeFilter === 'tutorial') {
                prefilter = { $or: [{ category: 'Tutorial' }, { tags: { $in: ['tutorial', 'guide'] } }] };
            } else if (typeFilter === 'discussion') {
                prefilter = { category: 'Discussion' };
            } else if (typeFilter === 'beginner') {
                prefilter = { tags: { $in: ['beginner', '101', 'basics'] } };
            }

            const aggregationPipeline = [
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "vector",
                        queryVector: queryVector,
                        numCandidates: 100,
                        limit: 30,
                        ...(Object.keys(prefilter).length > 0 ? { filter: prefilter } : {})
                    }
                }
            ];

            const vecResults = await PostVector.aggregate(aggregationPipeline);
            postIds = vecResults.map(v => v.postId);
        }

        // Fallback to text search if vector search fails or no results
        if (postIds.length === 0) {
            const regexQuery = {
                $or: [
                    { caption: { $regex: q, $options: 'i' } },
                    { category: { $regex: q, $options: 'i' } },
                    { tags: { $in: [new RegExp(q, 'i')] } }
                ],
                "user._id": { $nin: restrictedObjectIds },
                isAnonymous: { $ne: true },
                isVisible: { $ne: false },
                deletedAt: null
            };
            
            if (typeFilter === 'tutorial') {
                regexQuery.$or.push({ tags: 'tutorial' }, { category: 'Tutorial' });
            } else if (typeFilter === 'beginner') {
                regexQuery.$or.push({ tags: 'beginner' });
            }

            const posts = await Post.find(regexQuery).sort({ createdAt: -1 }).limit(20).lean();
            return posts.map(p => ({ ...p, type: 'post' }));
        }

        const posts = await Post.find({
            _id: { $in: postIds },
            "user._id": { $nin: restrictedObjectIds },
            isAnonymous: { $ne: true },
            isVisible: { $ne: false },
            deletedAt: null
        }).lean();
        
        // Re-order posts based on vector search results order
        const orderedPosts = postIds.map(id => posts.find(p => p._id.toString() === id.toString())).filter(Boolean);
        return orderedPosts.map(p => ({ ...p, type: 'post' }));

    } catch (err) {
        console.error("[RecommendationService] getPersonalizedSearch error:", err.message);
        return [];
    }
}

async function getUserMemory(userId) {
    try {
        const interest = await UserInterest.findOne({ userId }).lean();
        return interest || {
            topCategories: [],
            likedTags: [],
            recentSearches: []
        };
    } catch (err) {
        console.error("[RecommendationService] getUserMemory error:", err.message);
        return null;
    }
}

async function getUserAIProfile(userId) {
    try {
        const interest = await UserInterest.findOne({ userId }).lean();
        if (!interest) return { bio: "New user", traits: [] };

        return {
            interests: interest.topCategories,
            tags: interest.likedTags,
            lastSeen: interest.lastUpdated
        };
    } catch (err) {
        console.error("[RecommendationService] getUserAIProfile error:", err.message);
        return null;
    }
}

module.exports = {
    getRecommendedPosts,
    getRecommendedUsers,
    getSimilarPosts,
    getPersonalizedTrending,
    getPersonalizedSearch,
    getUserMemory,
    getUserAIProfile
};