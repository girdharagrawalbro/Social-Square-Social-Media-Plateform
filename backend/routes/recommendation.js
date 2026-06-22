const express = require("express");
const mongoose = require("mongoose");

const logger = require("../utils/logger");
const router = express.Router();
const verifyToken = require("../middleware/Verifytoken");
const softVerifyToken = require("../middleware/softVerifyToken");
const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};
const redis = require("../lib/redis");

const {
    getRecommendedUsers,
    getPersonalizedSearch
} = require("../services/recommendationService");
const Post = require("../models/Post");
const User = require("../models/User");

// ─── CURSOR HELPERS ──────────────────────────────────────────────────────────
const encodeCursor = (date, id) => {
    if (!date || !id) return null;
    const timestamp = new Date(date).getTime();
    return Buffer.from(`${timestamp}_${id}`).toString('base64');
};

const decodeCursor = (cursorStr) => {
    try {
        if (!cursorStr) return null;
        const decoded = Buffer.from(cursorStr, 'base64').toString('ascii');
        const [timestamp, id] = decoded.split('_');
        if (!timestamp || !id) return null;
        return { date: new Date(parseInt(timestamp)), id };
    } catch (e) {
        return null;
    }
};

// Helper to limit consecutive posts from the same user (maxConsecutive defaults to 2)
function limitConsecutiveUserPosts(posts, maxConsecutive = 2) {
    const result = [];
    const remaining = [...posts];
    let lastUserId = null;
    let consecutiveCount = 0;

    const getPostUserId = (post) => {
        if (post.isAnonymous) {
            return `anon_${post._id ? post._id.toString() : Math.random()}`;
        }
        const uid = post.user?._id || post.user;
        return uid ? uid.toString() : '';
    };

    while (remaining.length > 0) {
        let foundIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
            const p = remaining[i];
            const uid = getPostUserId(p);
            if (uid !== lastUserId || consecutiveCount < maxConsecutive) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx !== -1) {
            const post = remaining.splice(foundIdx, 1)[0];
            const uid = getPostUserId(post);
            if (uid === lastUserId) {
                consecutiveCount++;
            } else {
                lastUserId = uid;
                consecutiveCount = 1;
            }
            result.push(post);
        } else {
            // Exclude the rest if they would exceed consecutive limit and can't be interleaved
            break;
        }
    }
    return result;
}

// ─── RECOMMENDED POSTS ────────────────────────────────────────────────────────
router.get("/posts", verifyToken, async (req, res) => {
    const _tag = '[REC /posts]';
    const _t0 = Date.now();
    console.log(`${_tag} ── START ── userId=${req.userId}`);

    try {
        const userId = req.userId;
        const cursor = req.query.cursor;
        if (!userId) {
            console.error(`${_tag} ❌ No userId from token — verifyToken may have failed silently`);
            return res.status(401).json({ items: [], message: "Unauthorized" });
        }

        // ── Step 1: Load logged-in user ──────────────────────────────────────
        console.log(`${_tag} [1] Fetching loggedUser (following list)...`);
        const loggedUser = await User.findById(userId).select('following').lean();
        if (!loggedUser) {
            console.error(`${_tag} ❌ User not found in DB for userId=${userId}`);
            return res.status(404).json({ items: [], message: "User not found" });
        }
        const followingIds = (loggedUser?.following || []).map(id => id.toString());
        console.log(`${_tag} [1] ✅ User found — following ${followingIds.length} people`);

        // ── Step 2: Private user exclusion list (Redis cached) ───────────────
        const { getRestrictedUserIds } = require("../utils/privacy");
        const privateUserIds = await getRestrictedUserIds(userId);
        console.log(`${_tag} [2] ✅ Restricted users list resolved — ${privateUserIds.length} excluded`);

        // ── Step 3: Load user interest vector ────────────────────────────────
        console.log(`${_tag} [3] Loading UserInterest & PostVector models...`);
        let UserInterest, PostVector;
        try {
            ({ UserInterest, PostVector } = require("../models/Recommendation"));
        } catch (modelErr) {
            console.error(`${_tag} ❌ Failed to require Recommendation models: ${modelErr.message}`);
            throw modelErr;
        }

        console.log(`${_tag} [3] Querying UserInterest for userId=${userId}...`);
        const interest = await UserInterest.findOne({ userId }).lean();
        if (!interest) {
            console.warn(`${_tag} [3] ⚠️ No UserInterest document found for user — cold start, returning chronological posts`);
        } else if (!interest.interestVector || !interest.interestVector.length) {
            console.warn(`${_tag} [3] ⚠️ UserInterest exists but interestVector is empty — cold start`);
        } else {
            console.log(`${_tag} [3] ✅ Interest vector found — dim=${interest.interestVector.length}`);
        }

        // ── Step 4: Fetch candidate posts ─────────────────────────────────────
        console.log(`${_tag} [4] Fetching candidate posts (limit=100)...`);
        // FIX: MongoDB ignores $ne when $nin is present on the same field path.
        // Merge userId (as ObjectId) into the $nin array to correctly exclude self + restricted users.
        let selfObjectId;
        try { selfObjectId = new mongoose.Types.ObjectId(userId); } catch { selfObjectId = null; }
        const restrictedObjectIds = privateUserIds
            .map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
            .filter(Boolean);
        if (selfObjectId) restrictedObjectIds.push(selfObjectId);

        const candidatesQuery = {
            "user._id": { $nin: restrictedObjectIds },
            isAnonymous: { $ne: true },
            isVisible: { $ne: false },
            deletedAt: null
        };

        if (req.query.depth && ['quick_take', 'deep_dive', 'long_read'].includes(req.query.depth)) {
            candidatesQuery.depthScore = req.query.depth;
        }

        if (cursor) {
            const decoded = decodeCursor(cursor);
            if (decoded) {
                candidatesQuery.$or = [
                    { createdAt: { $lt: decoded.date } },
                    { createdAt: decoded.date, _id: { $lt: decoded.id } }
                ];
            }
        }

        const candidates = await Post.find(candidatesQuery)
            .sort({ createdAt: -1 })
            .limit(100)
            .select('_id createdAt likes reactions comments category tags score user caption image_urls image_url video videoThumbnail isCollaborative collaborators voiceNote mood isAiGenerated poll aiSummary mentions')
            .populate('mentions', 'username fullname')
            .lean()
            .maxTimeMS(10000);

        console.log(`${_tag} [4] ✅ Fetched ${candidates.length} candidate posts`);

        if (candidates.length > 0) {
            // Update fallback cache in background (fire and forget)
            redis.set('cache:fallback_posts', JSON.stringify(candidates.slice(0, 20)), 'EX', 600).catch(() => { });
        }

        const hasMore = candidates.length >= 100;
        const lastFetchedPost = candidates[candidates.length - 1];
        const nextCursor = (hasMore && lastFetchedPost) ? encodeCursor(lastFetchedPost.createdAt, lastFetchedPost._id) : null;

        if (!interest || !interest.interestVector || !interest.interestVector.length) {
            console.log(`${_tag} [4] Returning top ${Math.min(candidates.length, 20)} posts (no interest vector — chronological)`);
            return res.json({ items: candidates.slice(0, 20), nextCursor, hasMore, isColdStart: true });
        }

        // ── Step 5: Fetch post vectors ────────────────────────────────────────
        console.log(`${_tag} [5] Fetching PostVectors for ${candidates.length} candidates...`);
        const postVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } })
            .select('postId vector')
            .lean()
            .maxTimeMS(5000);
        const vecMap = new Map(postVecs.map(v => [v.postId.toString(), v.vector]));
        console.log(`${_tag} [5] ✅ Got ${postVecs.length} vectors`);

        // ── Step 6: Rank by cosine similarity + recency + popularity ──────────
        console.log(`${_tag} [6] Ranking candidates...`);
        const rankStart = Date.now();
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
            return { ...post, score }; // Embed score directly
        });
        ranked.sort((a, b) => b.score - a.score);
        console.log(`${_tag} [6] ✅ Ranked ${ranked.length} posts in ${Date.now() - rankStart}ms`);

        const result = limitConsecutiveUserPosts(ranked.slice(0, 30), 2);
        const elapsed = Date.now() - _t0;
        console.log(`${_tag} ✅ SUCCESS — returning ${result.length} posts in ${elapsed}ms`);
        res.json({ items: result, nextCursor, hasMore });

    } catch (err) {
        const elapsed = Date.now() - _t0;
        console.error(`${_tag} ❌ MAIN HANDLER FAILED after ${elapsed}ms: ${err.message}`);

        // ── Fallback 1: Try Redis Cache ───────────────────────────────────────
        try {
            const cachedFallback = await redis.get('cache:fallback_posts');
            if (cachedFallback) {
                console.log(`${_tag} 🔄 Serving from Redis fallback cache`);
                return res.json({
                    items: limitConsecutiveUserPosts(JSON.parse(cachedFallback), 2),
                    isFallback: true,
                    isCached: true,
                    message: "Showing cached posts (Database is slow)"
                });
            }
        } catch (cacheErr) {
            console.error(`${_tag} ❌ Redis cache fallback failed: ${cacheErr.message}`);
        }

        // ── Fallback 2: Simple DB query ────────────────────────────────────────
        console.log(`${_tag} 🔄 Attempting DB fallback (simple chronological query)...`);
        try {
            const fallback = await Post.find({ isAnonymous: { $ne: true }, deletedAt: null })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean()
                .maxTimeMS(4000);

            console.log(`${_tag} ✅ DB Fallback succeeded`);
            return res.json({
                items: limitConsecutiveUserPosts(fallback, 2),
                isFallback: true,
                message: "Showing latest posts (AI engine temporarily slow)"
            });
        } catch (innerErr) {
            console.error(`${_tag} ❌ ALL FALLBACKS FAILED: ${innerErr.message}`);
            res.json({
                items: [],
                message: "Service temporarily unavailable. Please refresh."
            });
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
router.get("/similar/:postId", verifyToken, [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    const _tag = '[REC /similar]';
    const _t0 = Date.now();
    const { postId } = req.params;
    const userId = req.userId;

    try {
        const { PostVector } = require("../models/Recommendation");

        // 1. Resolve Viewer Identity & Following List (Redis cached)
        const loggedUser = await User.findById(userId).select('following').lean();
        if (!loggedUser) return res.status(404).json({ message: "User not found" });
        const followingIds = (loggedUser?.following || []).map(id => id.toString());

        // 2. Resolve Restricted User List (Privacy Filter - Redis cached)
        const { getRestrictedUserIds, canViewPost } = require("../utils/privacy");
        const restrictedUserIds = await getRestrictedUserIds(userId);

        // 3. Determine Privacy Bucket for Result Caching
        const targetPost = await Post.findById(postId).populate('user._id', 'isPrivate followers').lean();

        if (!targetPost || targetPost.isVisible === false || targetPost.deletedAt) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Security check: Can the requester even see this post?
        // Note: canViewPost is async
        const canSeeTarget = await canViewPost(targetPost, userId);
        if (!canSeeTarget) {
            return res.status(403).json({ message: "You do not have permission to view this post's recommendations" });
        }

        const targetAuthor = targetPost.user?._id;
        const targetAuthorId = targetAuthor?._id?.toString() || targetAuthor?.toString();
        const followsAuthor = followingIds.includes(targetAuthorId);
        const privacyBucket = followsAuthor ? 'follows_author' : 'public';
        const resultCacheKey = `sim_posts:res:${postId}:${privacyBucket}`;

        // Check Result Cache
        try {
            const cachedResult = await redis.get(resultCacheKey);
            if (cachedResult) {
                console.log(`${_tag} ✅ Cache hit for bucket: ${privacyBucket}`);
                const parsed = JSON.parse(cachedResult);
                return res.json({
                    items: parsed.items,
                    method: parsed.method,
                    count: parsed.items.length,
                    isCached: true
                });
            }
        } catch (cacheErr) {
            console.warn(`${_tag} Result cache unavailable:`, cacheErr.message);
        }

        // 4. Recommendation Logic
        let similarPosts = [];
        let method = 'vector';
        const targetPostVecDoc = await PostVector.findOne({ postId }).lean();

        if (targetPostVecDoc && targetPostVecDoc.vector && targetPostVecDoc.vector.length > 0) {
            // --- VECTOR PATH (Atlas Vector Search / ANN) ---
            console.log(`${_tag} 🧠 Using Atlas Vector Search (ANN)`);
            try {
                similarPosts = await PostVector.aggregate([
                    {
                        $vectorSearch: {
                            index: "vector_index",
                            path: "vector",
                            queryVector: targetPostVecDoc.vector,
                            numCandidates: 100,
                            limit: 48
                        }
                    },
                    {
                        $lookup: {
                            from: "posts",
                            localField: "postId",
                            foreignField: "_id",
                            as: "post"
                        }
                    },
                    { $unwind: "$post" },
                    {
                        $match: {
                            // FIX: use $nin to exclude both self + restricted. $ne + $nin on same key silently drops $ne.
                            "post._id": { $nin: [new mongoose.Types.ObjectId(postId)] },
                            "post.user._id": { $nin: restrictedUserIds.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } }).filter(Boolean) },
                            "post.isAnonymous": { $ne: true },
                            "post.isVisible": { $ne: false },
                            // FIX: In aggregation $match, use $in: [null] to match null or missing deletedAt
                            "post.deletedAt": { $in: [null] }
                        }
                    },
                    { $limit: 15 },
                    { $replaceRoot: { newRoot: "$post" } }
                ]);
            } catch (vectorErr) {
                console.error(`${_tag} ❌ Atlas Vector Search failed:`, vectorErr.message);
                // Fallback to manual ranking
                method = 'vector_manual';
                const candidates = await Post.find({
                    _id: { $ne: postId },
                    "user._id": { $nin: restrictedUserIds },
                    isAnonymous: { $ne: true },
                    isVisible: { $ne: false },
                    deletedAt: null
                }).sort({ createdAt: -1 }).limit(100).lean();

                const candidateVecs = await PostVector.find({ postId: { $in: candidates.map(c => c._id) } }).lean();
                const vecMap = new Map(candidateVecs.map(v => [v.postId.toString(), v.vector]));
                const targetVec = targetPostVecDoc.vector;
                const targetMag = Math.sqrt(targetVec.reduce((sum, val) => sum + val * val, 0));

                similarPosts = candidates.map(post => {
                    const postVec = vecMap.get(post._id.toString());
                    let similarity = 0;
                    if (postVec && targetMag) {
                        const dotProduct = targetVec.reduce((sum, val, i) => sum + val * (postVec[i] || 0), 0);
                        const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                        similarity = postMag ? dotProduct / (targetMag * postMag) : 0;
                    }
                    return { ...post, similarity };
                }).sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 15);
            }
        } else {
            // --- KEYWORD FALLBACK PATH ---
            method = 'fallback';
            console.log(`${_tag} ⌨️ Using Keyword Fallback (Category/Tags) for postId=${postId}`);

            // Emit metric/log event for monitoring
            logger.info(`similarity_fallback_used`, { postId, category: targetPost.category });

            similarPosts = await Post.find({
                _id: { $ne: postId },
                "user._id": { $nin: restrictedUserIds },
                isAnonymous: { $ne: true },
                isVisible: { $ne: false },
                deletedAt: null,
                $or: targetPost.category
                    ? [{ category: targetPost.category }, { tags: { $in: targetPost.tags || [] } }]
                    : [{}]
            }).sort({ createdAt: -1 }).limit(15).lean();
        }

        // 5. Finalize, Threshold Check & Cache Result
        const MIN_THRESHOLD = 3;
        let finalItems = similarPosts;
        let reason = null;

        if (similarPosts.length < MIN_THRESHOLD) {
            console.warn(`${_tag} ⚠️ Insufficient candidates (${similarPosts.length} < ${MIN_THRESHOLD})`);
            finalItems = [];
            reason = 'insufficient_candidates';
        }

        const responsePayload = {
            items: finalItems,
            method,
            count: finalItems.length,
            reason
        };

        if (finalItems.length > 0) {
            await redis.set(resultCacheKey, JSON.stringify(responsePayload), 'EX', 600);
        }

        const elapsed = Date.now() - _t0;
        console.log(`${_tag} ✅ Success — returned ${finalItems.length} posts in ${elapsed}ms (method=${method})`);
        res.json(responsePayload);

    } catch (err) {
        console.error(`${_tag} ❌ Critical Failure:`, err);
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

        const { getRestrictedUserIds } = require("../utils/privacy");
        const restrictedIds = await getRestrictedUserIds(userId);

        // FIX: cast restrictedIds strings to ObjectIds for proper $nin matching
        const restrictedObjIds = restrictedIds
            .map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
            .filter(Boolean);
        // Also exclude logged-in user's own posts from trending
        let selfObjId;
        try { selfObjId = new mongoose.Types.ObjectId(userId); } catch { selfObjId = null; }
        if (selfObjId) restrictedObjIds.push(selfObjId);

        const posts = await Post.find({
            isAnonymous: { $ne: true },
            isVisible: { $ne: false },
            deletedAt: null,
            "user._id": { $nin: restrictedObjIds },
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

        const trendingItems = limitConsecutiveUserPosts(boosted, 2).slice(0, 20);
        res.json({ items: trendingItems });
    } catch (err) {
        console.error('[Recommendation /trending]', err);
        res.status(500).json({ message: "Failed to fetch trending" });
    }
});

// ─── PERSONALIZED SEARCH ──────────────────────────────────────────────────────
router.get("/search", verifyToken, [
    query('q').optional().trim().escape(),
    query('typeFilter').optional().trim().escape(),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const q = req.query.q || "";
        const typeFilter = req.query.typeFilter || "all";

        const { getRestrictedUserIds } = require("../utils/privacy");
        const restrictedIds = await getRestrictedUserIds(userId);

        const items = await getPersonalizedSearch(userId, q, restrictedIds, typeFilter);
        res.json({ items });
    } catch (err) {
        console.error('[Recommendation /search]', err);
        res.status(500).json({ message: "Failed to fetch personalized search" });
    }
});

// ─── SYNTHESIZE AI ANSWER ───────────────────────────────────────────────────
router.post("/search/synthesize", softVerifyToken, [
    body('q').notEmpty().trim().escape().withMessage('Query is required'),
    body('itemIds').isArray().withMessage('itemIds must be an array'),
    validate
], async (req, res) => {
    try {
        const { q, itemIds } = req.body;
        if (!itemIds || itemIds.length === 0) {
            return res.status(200).json({ answer: "I couldn't find enough context to answer that question." });
        }

        const Post = require("../models/Post");
        const Comment = require("../models/Comment");
        const { generateText } = require("../utils/gemini");

        // Fetch snippets for context
        const posts = await Post.find({ _id: { $in: itemIds } }).select('caption category').limit(5).lean();
        const comments = await Comment.find({ _id: { $in: itemIds } }).select('content').limit(5).lean();

        let contextText = "";
        posts.forEach((p, i) => contextText += `[Post ${i + 1}] Category: ${p.category}\nContent: ${p.caption}\n\n`);
        comments.forEach((c, i) => contextText += `[Comment ${i + 1}] Content: ${c.content}\n\n`);

        const prompt = `You are a helpful community assistant. Based on the following discussions from our platform, provide a direct, concise answer to the user's query.

User Query: "${q}"

Discussions Context:
${contextText}

Instructions:
1. Answer the query directly using ONLY the provided context.
2. If the context does not contain the answer, say "I couldn't find a definitive answer in the current discussions, but here are some related posts."
3. Highlight the most useful point or "best answer" in **bold**.
4. Keep it under 3-4 sentences. Make it sound natural and helpful.`;

        const answer = await generateText(prompt, { maxTokens: 200, temperature: 0.3 });
        res.status(200).json({ answer: answer || "I couldn't find enough context to answer that." });
    } catch (err) {
        console.error('[Recommendation /search/synthesize]', err);
        res.status(500).json({ error: "Failed to synthesize answer" });
    }
});

// ─── LOG ACTIVITY ─────────────────────────────────────────────────────────────
router.post("/activity", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    body('action').notEmpty().trim().escape(),
    body('duration').optional().isNumeric(),
    validate
], async (req, res) => {
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
router.post("/batch-activity", verifyToken, [
    body('activities').isArray().withMessage('activities must be an array'),
    body('activities.*.postId').isMongoId().withMessage('Invalid post ID in array'),
    body('activities.*.action').notEmpty().trim().escape(),
    body('activities.*.duration').optional().isNumeric(),
    validate
], async (req, res) => {
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