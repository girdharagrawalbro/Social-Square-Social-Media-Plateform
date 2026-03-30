const express = require("express");
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

router.get("/posts", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { UserInterest, PostVector } = require("../models/Recommendation");

        // 1. Get User Interest Profile
        const interest = await UserInterest.findOne({ userId });

        // 2. Fetch candidate posts (exclude own, skip 0-vector if possible)
        // For simplicity, we'll take the last 200 posts
        const candidates = await Post.find({ "user._id": { $ne: userId } })
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
        const items = await getSimilarPosts(req.params.postId);
        res.json({ items });
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