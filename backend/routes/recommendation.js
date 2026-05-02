const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const verifyToken = require("../middleware/Verifytoken");
const redis = require("../lib/redis");

const {
    getRecommendedUsers,
    getPersonalizedSearch
} = require("../services/recommendationService");
const Post = require("../models/Post");
const User = require("../models/User");

// ─── RECOMMENDED POSTS ────────────────────────────────────────────────────────
router.get("/posts", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { UserInterest, PostVector } = require("../models/Recommendation");

        // 🔒 Privacy Guard: Cache private user IDs per user for 60s
        const loggedUser = await User.findById(userId).select('following').lean();
        const followingIds = (loggedUser?.following || []).map(id => id.toString());

        const cacheKey = `private_users:excl:${userId}`;
        let privateUserIds;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                privateUserIds = JSON.parse(cached);
            } else {
                const privateUsers = await User.find({
                    isPrivate: true,
                    _id: { $nin: [...followingIds, userId] }
                }).select('_id').lean();
                privateUserIds = privateUsers.map(u => u._id.toString());
                await redis.set(cacheKey, JSON.stringify(privateUserIds), 'EX', 60);
            }
        } catch (_) {
            const privateUsers = await User.find({
                isPrivate: true,
                _id: { $nin: [...followingIds, userId] }
            }).select('_id').lean();
            privateUserIds = privateUsers.map(u => u._id.toString());
        }

        // 1. Get User Interest Profile
        const interest = await UserInterest.findOne({ userId }).lean();

        // 2. Fetch candidate posts
        const candidates = await Post.find({
            "user._id": { $ne: userId, $nin: privateUserIds },
            isAnonymous: { $ne: true }
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .select('_id createdAt likes category tags score user')
            .lean();

        if (!interest || !interest.interestVector || !interest.interestVector.length) {
            return res.json({ items: candidates.slice(0, 20) });
        }

        // 3. Get Vectors for candidates
        const postVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } })
            .select('postId vector')
            .lean();
        const vecMap = new Map(postVecs.map(v => [v.postId.toString(), v.vector]));

        // 4. Rank using formula: score = 0.5*sim + 0.3*recency + 0.2*popularity
        const userVec = interest.interestVector;
        const userMag = Math.sqrt(userVec.reduce((sum, val) => sum + val * val, 0));

        const ranked = candidates.map(post => {
            const postVec = vecMap.get(post._id.toString());
            let similarity = 0;

            if (postVec && userMag) {
                const dotProduct = userVec.reduce((sum, val, i) => sum + val * (postVec[i] || 0), 0);
                const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                similarity = postMag ? dotProduct / (userMag * postMag) : 0;
            }

            const hoursOld = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
            const recency = Math.exp(-hoursOld / 24);
            const popularity = Math.min(1, (post.likes?.length || 0) / 50);
            const score = (0.5 * similarity) + (0.3 * recency) + (0.2 * popularity);
            return { post, score };
        });

        ranked.sort((a, b) => b.score - a.score);

        const topIds = ranked.slice(0, 30).map(r => r.post._id);
        const fullPosts = await Post.find({ _id: { $in: topIds } }).lean();
        const idOrder = new Map(topIds.map((id, i) => [id.toString(), i]));
        fullPosts.sort((a, b) => (idOrder.get(a._id.toString()) || 0) - (idOrder.get(b._id.toString()) || 0));

        res.json({ items: fullPosts });
    } catch (err) {
        console.error('[Recommendation /posts] CRITICAL:', err.message);
        
        // 🛡️ Robust Fallback: Try a super-simple chronological query if recommendations fail
        try {
            const fallback = await Post.find({ isAnonymous: { $ne: true } })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean()
                .maxTimeMS(3000); // Fail fast (3s)
            
            return res.json({ 
                items: fallback, 
                isFallback: true,
                message: "Showing latest posts (AI engine temporarily slow)" 
            });
        } catch (innerErr) {
            console.error('[Recommendation /posts] Fallback failed:', innerErr.message);
            // Last resort: Return empty items instead of 500
            res.json({ items: [], message: "Service temporarily unavailable" });
        }
    }
});

// ─── RECOMMENDED USERS ────────────────────────────────────────────────────────
router.get("/users", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const items = await getRecommendedUsers(userId);
        res.json({ items });
    } catch (err) {
        console.error('[Recommendation /users]', err);
        res.status(500).json({ message: "Failed to fetch user recommendations" });
    }
});

// ─── SIMILAR POSTS ────────────────────────────────────────────────────────────
router.get("/similar/:postId", verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { PostVector } = require("../models/Recommendation");

        const targetPostVecDoc = await PostVector.findOne({ postId });
        if (!targetPostVecDoc || !targetPostVecDoc.vector || targetPostVecDoc.vector.length === 0) {
            const targetPost = await Post.findById(postId);
            if (!targetPost) return res.status(404).json({ message: "Post not found" });

            const fallbackPosts = await Post.find({
                _id: { $ne: postId },
                $or: targetPost.category
                    ? [{ category: targetPost.category }, { tags: { $in: targetPost.tags || [] } }]
                    : [{}]
            }).sort({ createdAt: -1 }).limit(15).lean();
            return res.json({ items: fallbackPosts });
        }

        const targetVec = targetPostVecDoc.vector;

        const privateUsers = await User.find({ isPrivate: true }).select('_id').lean();
        const privateUserIds = privateUsers.map(u => u._id.toString());

        const candidates = await Post.find({
            _id: { $ne: postId },
            'user._id': { $nin: privateUserIds }
        })
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        const candidateVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } }).lean();
        const vecMap = new Map(candidateVecs.map(v => [v.postId.toString(), v.vector]));

        const targetMag = Math.sqrt(targetVec.reduce((sum, val) => sum + val * val, 0));

        const ranked = candidates.map(post => {
            const postVec = vecMap.get(post._id.toString());
            let similarity = 0;

            if (postVec && targetMag) {
                const dotProduct = targetVec.reduce((sum, val, i) => sum + val * (postVec[i] || 0), 0);
                const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                similarity = postMag ? dotProduct / (targetMag * postMag) : 0;
            }

            return { post, similarity };
        });

        ranked.sort((a, b) => b.similarity - a.similarity);
        res.json({ items: ranked.slice(0, 15).map(r => r.post) });
    } catch (err) {
        console.error('[Recommendation /similar]', err);
        res.status(500).json({ message: "Failed to fetch similar posts" });
    }
});

// ─── TRENDING ─────────────────────────────────────────────────────────────────
// FIX: getPersonalizedTrending was never imported — replaced with inline logic
router.get("/trending", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get user's following list to boost their content
        const loggedUser = await User.findById(userId).select('following').lean();
        const followingIds = (loggedUser?.following || []).map(id => id.toString());

        const posts = await Post.find({
            isAnonymous: { $ne: true },
            createdAt: { $gte: sevenDaysAgo }
        })
            .sort({ score: -1, createdAt: -1 })
            .limit(50)
            .lean();

        // Boost posts from followed users
        const boosted = posts.map(p => ({
            ...p,
            _boost: followingIds.includes(p.user?._id?.toString()) ? 1 : 0
        }));
        boosted.sort((a, b) => b._boost - a._boost || b.score - a.score);

        res.json({ items: boosted.slice(0, 20) });
    } catch (err) {
        console.error('[Recommendation /trending]', err);
        res.status(500).json({ message: "Failed to fetch trending" });
    }
});

// ─── PERSONALIZED SEARCH ──────────────────────────────────────────────────────
router.get("/search", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const q = req.query.q || "";
        const items = await getPersonalizedSearch(userId, q);
        res.json({ items });
    } catch (err) {
        console.error('[Recommendation /search]', err);
        res.status(500).json({ message: "Failed to fetch personalized search" });
    }
});

// ─── LOG ACTIVITY ─────────────────────────────────────────────────────────────
router.post("/activity", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { postId, action, duration } = req.body;
        const { publishEvent } = require("../services/recommendationPublisher");

        const post = await Post.findById(postId).select('category tags').lean();
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
        console.error('[Recommendation /activity]', err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── BATCH ACTIVITY ───────────────────────────────────────────────────────────
router.post("/batch-activity", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { activities } = req.body;
        const { publishEvent } = require("../services/recommendationPublisher");

        if (!Array.isArray(activities) || activities.length === 0) {
            return res.json({ success: true, message: "No activities to process" });
        }

        await Promise.all(activities.map(async (act) => {
            try {
                // FIX: use .lean() and .select() to avoid loading full documents
                const post = await Post.findById(act.postId).select('category tags').lean();
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
                console.error("Failed to publish batched event:", innerErr.message);
            }
        }));

        res.json({ success: true, processed: activities.length });
    } catch (err) {
        console.error('[Recommendation /batch-activity]', err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─── USER MEMORY ──────────────────────────────────────────────────────────────
router.get("/memory", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { UserInterest } = require("../models/Recommendation");
        const interest = await UserInterest.findOne({ userId }).lean();

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
        console.error('[Recommendation /memory]', err);
        res.status(500).json({ message: "Failed to fetch user memory" });
    }
});

module.exports = router;