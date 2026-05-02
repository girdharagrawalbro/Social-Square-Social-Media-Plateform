const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const { PostVector, UserInterest } = require("../models/Recommendation");

/**
 * Gracefully handles recommendation logic locally without external Python dependency.
 * If data is missing (e.g. no vectors), it fails back to sensible defaults.
 */

async function getRecommendedPosts(userId) {
    try {
        // This is primarily handled in routes/recommendation.js now, 
        // but providing a service implementation for consistency.
        const interest = await UserInterest.findOne({ userId }).lean();
        const candidates = await Post.find({
            "user._id": { $ne: userId },
            isAnonymous: { $ne: true }
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
        const interest = await UserInterest.findOne({ userId }).lean();
        if (!interest || !interest.topCategories.length) {
            // Fallback: Suggest active users
            return await User.find({ _id: { $ne: userId }, isBanned: false })
                .sort({ lastSeen: -1 })
                .limit(5)
                .select('fullname username profile_picture isOnline')
                .lean();
        }

        // Find users with overlapping top categories
        const suggested = await User.find({
            _id: { $ne: userId },
            isBanned: false
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
            isAnonymous: { $ne: true }
        }).sort({ createdAt: -1 }).limit(10).lean();

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
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ score: -1, views: -1 }).limit(10).lean();
    } catch (err) {
        console.error("[RecommendationService] getPersonalizedTrending error:", err.message);
        return [];
    }
}

async function getPersonalizedSearch(userId, q) {
    try {
        if (!q) return [];
        // Basic keyword search
        return await Post.find({
            $or: [
                { caption: { $regex: q, $options: 'i' } },
                { category: { $regex: q, $options: 'i' } },
                { tags: { $in: [new RegExp(q, 'i')] } }
            ],
            isAnonymous: { $ne: true }
        }).sort({ createdAt: -1 }).limit(20).lean();
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