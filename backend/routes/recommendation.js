const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const verifyToken = require("../middleware/Verifytoken");

const {
    getRecommendedPosts,
    getRecommendedUsers,
    getSimilarPosts,
    getPersonalizedSearch,
    getUserMemory
} = require("../services/recommendationService");
const Post = require("../models/Post");
const User = require("../models/User");

router.get("/posts", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { UserInterest, PostVector } = require("../models/Recommendation");

        // 🔒 Privacy Guard: Exclude private users unless followed
        const loggedUser = await User.findById(userId).select('following').lean();
        const followingIds = (loggedUser?.following || []).map(id => id.toString());

        const privateUsers = await User.find({
            isPrivate: true,
            _id: { $nin: [...followingIds, userId] }
        }).select('_id').lean();
        const privateUserIds = privateUsers.map(u => u._id.toString());

        // 1. Get User Interest Profile
        const interest = await UserInterest.findOne({ userId });

        // 2. Fetch candidate posts (exclude own, private, anonymous)
        const candidates = await Post.find({
            "user._id": { $ne: userId, $nin: privateUserIds },
            isAnonymous: { $ne: true }
        })
            .sort({ createdAt: -1 })
            .limit(200);

        if (!interest || !interest.interestVector.length) {
            return res.json({ items: candidates.slice(0, 20) });
        }

        // 3. Get Vectors for candidates
        const postVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } });
        const vecMap = new Map(postVecs.map(v => [v.postId.toString(), v.vector]));

        // 4. Rank using formula: score = 0.5*sim + 0.3*recency + 0.2*popularity
        const userVec = interest.interestVector;

        const ranked = candidates.map(post => {
            const postVec = vecMap.get(post._id.toString());
            let similarity = 0;

            if (postVec) {
                // Cosine Similarity
                const dotProduct = userVec.reduce((sum, val, i) => sum + val * postVec[i], 0);
                const userMag = Math.sqrt(userVec.reduce((sum, val) => sum + val * val, 0));
                const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                similarity = (userMag && postMag) ? dotProduct / (userMag * postMag) : 0;
            }

            // Recency score (higher for newer)
            const hoursOld = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
            const recency = Math.exp(-hoursOld / 24); // decays over 24h

            // Popularity (based on likes)
            const popularity = Math.min(1, (post.likes?.length || 0) / 50);

            const score = (0.5 * similarity) + (0.3 * recency) + (0.2 * popularity);
            return { post, score };
        });

        ranked.sort((a, b) => b.score - a.score);

        res.json({ items: ranked.slice(0, 30).map(r => r.post) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch recommendations" });
    }
});

router.get("/users", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const items = await getRecommendedUsers(userId);
        res.json({ items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user recommendations" });
    }
});

router.get("/similar/:postId", verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { PostVector } = require("../models/Recommendation");

        // 1. Get Target Post Vector
        const targetPostVecDoc = await PostVector.findOne({ postId });
        if (!targetPostVecDoc || !targetPostVecDoc.vector || targetPostVecDoc.vector.length === 0) {
            // Fallback: Return recent posts with same category/tags or just recent
            const targetPost = await Post.findById(postId);
            if (!targetPost) return res.status(404).json({ message: "Post not found" });

            const fallbackPosts = await Post.find({
                _id: { $ne: postId },
                $or: targetPost.category ? [{ category: targetPost.category }, { tags: { $in: targetPost.tags || [] } }] : [{}]
            }).sort({ createdAt: -1 }).limit(15);
            return res.json({ items: fallbackPosts });
        }

        const targetVec = targetPostVecDoc.vector;

        // 🔒 Privacy Guard: Exclude private users unless followed
        const privateUsers = await User.find({ isPrivate: true }).select('_id').lean();
        const privateUserIds = privateUsers.map(u => u._id.toString());

        // 2. Fetch candidates (exclude the target post and private users)
        const candidates = await Post.find({ _id: { $ne: postId }, 'user._id': { $nin: privateUserIds } })
            .sort({ createdAt: -1 })
            .limit(200);

        // 3. Get vectors for candidates
        const candidateVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } });
        const vecMap = new Map(candidateVecs.map(v => [v.postId.toString(), v.vector]));

        // 4. Calculate similarity
        const targetMag = Math.sqrt(targetVec.reduce((sum, val) => sum + val * val, 0));

        const ranked = candidates.map(post => {
            const postVec = vecMap.get(post._id.toString());
            let similarity = 0;

            if (postVec && targetMag) {
                const dotProduct = targetVec.reduce((sum, val, i) => sum + val * postVec[i], 0);
                const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                similarity = postMag ? dotProduct / (targetMag * postMag) : 0;
            }

            return { post, similarity };
        });

        // 5. Sort by similarity descending
        ranked.sort((a, b) => b.similarity - a.similarity);

        // Return top 15 similar posts
        res.json({ items: ranked.slice(0, 15).map(r => r.post) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch similar posts" });
    }
});

router.get("/trending", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const items = await getPersonalizedTrending(userId);
        res.json({ items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch trending" });
    }
});

router.get("/search", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const q = req.query.q || "";
        const items = await getPersonalizedSearch(userId, q);
        res.json({ items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch personalized search" });
    }
});

router.post("/activity", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { postId, action, duration } = req.body;
        const { publishEvent } = require("../services/recommendationPublisher");

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found" });

        await publishEvent(`user.activity.${action}`, {
            userId,
            postId,
            action,
            duration,
            category: post.category || "",
            tags: post.tags || [],
            timestamp: Date.now() / 1000,
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/batch-activity", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { activities } = req.body; // Array of { postId, action, duration, timestamp }
        const { publishEvent } = require("../services/recommendationPublisher");

        if (!Array.isArray(activities) || activities.length === 0) {
            return res.json({ success: true, message: "No activities to process" });
        }

        // Process in parallel to be efficient
        await Promise.all(activities.map(async (act) => {
            try {
                const post = await Post.findById(act.postId);
                if (!post) return;

                await publishEvent(`user.activity.${act.action}`, {
                    userId,
                    postId: act.postId,
                    action: act.action,
                    duration: act.duration,
                    category: post.category || "",
                    tags: post.tags || [],
                    timestamp: act.timestamp || Date.now() / 1000,
                });
            } catch (innerErr) {
                console.error("Failed to publish batched event", innerErr);
            }
        }));

        res.json({ success: true, processed: activities.length });
    } catch (err) {
        console.error("Batch activity error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/memory", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { UserInterest } = require("../models/Recommendation");
        const interest = await UserInterest.findOne({ userId });

        if (!interest) {
            return res.json({
                userId,
                top_categories: [],
                liked_tags: [],
                recent_searches: [],
                behavior_vector: []
            });
        }

        res.json({
            userId,
            top_categories: interest.topCategories,
            liked_tags: interest.likedTags,
            recent_searches: interest.recentSearches,
            behavior_vector: interest.interestVector
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user memory" });
    }
});

module.exports = router;
