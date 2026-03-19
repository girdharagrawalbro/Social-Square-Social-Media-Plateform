const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const { emailQueue } = require("../queues/emailQueue");
const { publish } = require('../lib/nats');

const router = express.Router();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Compute engagement score for feed algorithm
// Higher score = shown higher in feed
function computeScore(post, followingIds = []) {
    const now = Date.now();
    const ageMs = now - new Date(post.createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    const likeScore = (post.likes?.length || 0) * 2;
    const commentScore = (post.comments?.length || 0) * 3;
    const followBoost = followingIds.includes(post.user._id.toString()) ? 20 : 0;
    const recencyScore = Math.max(0, 50 - ageHours * 0.5); // decays over time

    return likeScore + commentScore + followBoost + recencyScore;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

router.post("/create", async (req, res) => {
    try {
        const { caption, loggeduser, category, imageURLs, location, music } = req.body;
        if (!caption || !loggeduser || !category) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const userDetails = await User.findById(loggeduser).select('username fullname profile_picture');
        if (!userDetails) return res.status(404).json({ message: "User not found." });

        const newPost = new Post({
            caption,
            category,
            image_urls: Array.isArray(imageURLs) ? imageURLs : [],
            user: {
                _id: userDetails._id,
                fullname: userDetails.fullname,
                profile_picture: userDetails.profile_picture,
            },
            location: location || {},
            music: music || {},
        });

        await newPost.save();

        await emailQueue.add('sendWelcome', { userId: userDetails._id }, {
            attempts: 3, backoff: { type: 'exponential', delay: 5000 }
        });

        publish('posts.created', {
            id: newPost._id, user: newPost.user, category: newPost.category
        }).catch(err => console.warn('[NATS] publish failed:', err.message));

        res.status(201).json(newPost);
    } catch (error) {
        console.error("Error creating post:", error.message);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

router.put("/update/:postId", async (req, res) => {
    try {
        const { postId } = req.params;
        const { caption, category, userId } = req.body;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });

        // Only owner can update
        if (post.user._id.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized." });
        }

        if (caption) post.caption = caption;
        if (category) post.category = category;

        await post.save();
        res.status(200).json(post);
    } catch (error) {
        console.error("Error updating post:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

router.delete("/delete/:postId", async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });

        // Only owner can delete
        if (post.user._id.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized." });
        }

        await Post.findByIdAndDelete(postId);
        res.status(200).json({ message: "Post deleted.", postId });
    } catch (error) {
        console.error("Error deleting post:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// ─── FEED (with algorithm) ────────────────────────────────────────────────────
// GET /api/post?cursor=<id>&limit=10&userId=<id>
// Algorithm: followed users first + engagement boost + recency + category match

router.get("/", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const userId = req.query.userId;

        // Get user's following list and category interests
        let followingIds = [];
        let userCategories = [];

        if (userId) {
            const user = await User.findById(userId).select('following');
            if (user) {
                followingIds = user.following.map(id => id.toString());
            }

            // Get categories from user's liked posts (their interests)
            const likedPosts = await Post.find({ likes: userId }).select('category').limit(20);
            userCategories = [...new Set(likedPosts.map(p => p.category))];
        }

        const query = cursor ? { _id: { $lt: cursor } } : {};

        // Fetch more than needed so we can sort by score
        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit * 3); // fetch 3x to allow re-sorting

        // Score each post
        const scored = posts.map(post => {
            let score = computeScore(post, followingIds);

            // Boost if matches user's category interests
            if (userCategories.includes(post.category)) score += 15;

            return { post, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Take only `limit` posts
        const result = scored.slice(0, limit).map(s => s.post);
        const hasMore = posts.length >= limit * 3 || scored.length > limit;
        const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;

        res.status(200).json({ posts: result, nextCursor, hasMore });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── LIKE ─────────────────────────────────────────────────────────────────────

router.post("/like", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!userId || !postId) return res.status(400).json({ message: 'Both userId and postId are required.' });

        const post = await Post.findById(postId);
        if (!post.likes.includes(userId)) {
            post.likes.push(userId);
            // Update score on like
            post.score = computeScore(post);
            await post.save();
            res.status(200).json({ message: "Success" });
        } else {
            res.status(400).json({ message: "You already liked this post." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── UNLIKE ───────────────────────────────────────────────────────────────────

router.post("/unlike", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!userId || !postId) return res.status(400).json({ message: 'Both userId and postId are required.' });

        const post = await Post.findById(postId);
        if (post.likes.includes(userId)) {
            await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
            // Update score on unlike
            post.likes = post.likes.filter(id => id.toString() !== userId);
            post.score = computeScore(post);
            await post.save();
            res.status(200).json({ message: "success" });
        } else {
            res.status(400).json({ message: "You haven't liked this post." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

router.get('/comments', async (req, res) => {
    try {
        const postId = req.headers.authorization;
        if (!postId) return res.status(400).json({ error: 'postId is required' });
        const comments = await Comment.find({ postId });
        res.status(200).json(comments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/comments/add', async (req, res) => {
    try {
        const { content, postId, user } = req.body;
        if (!content || !postId || !user) return res.status(400).json({ error: 'Invalid request data' });

        const newComment = new Comment({ postId, content, user });
        await newComment.save();

        const post = await Post.findById(postId);
        post.comments.push(newComment._id);
        // Update score on comment
        post.score = computeScore(post);
        await post.save();

        return res.status(200).json(newComment);
    } catch (error) { return res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;