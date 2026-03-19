const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const { emailQueue } = require("../queues/emailQueue");
const { publish } = require('../lib/nats');

const router = express.Router();

function computeScore(post, followingIds = []) {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    return (post.likes?.length || 0) * 2 + (post.comments?.length || 0) * 3
        + (followingIds.includes(post.user._id.toString()) ? 20 : 0)
        + Math.max(0, 50 - ageHours * 0.5);
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
    try {
        const { caption, loggeduser, category, imageURLs, location, music } = req.body;
        if (!caption || !loggeduser || !category) return res.status(400).json({ message: "All fields are required." });
        const userDetails = await User.findById(loggeduser).select('username fullname profile_picture');
        if (!userDetails) return res.status(404).json({ message: "User not found." });
        const newPost = new Post({
            caption, category,
            image_urls: Array.isArray(imageURLs) ? imageURLs : [],
            user: { _id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
            location: location || {}, music: music || {},
        });
        await newPost.save();
        await emailQueue.add('sendWelcome', { userId: userDetails._id }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
        publish('posts.created', { id: newPost._id, user: newPost.user, category: newPost.category }).catch(err => console.warn('[NATS]:', err.message));
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.put("/update/:postId", async (req, res) => {
    try {
        const { caption, category, userId } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.user._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized." });
        if (caption) post.caption = caption;
        if (category) post.category = category;
        await post.save();
        res.status(200).json(post);
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete("/delete/:postId", async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.user._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized." });
        await Post.findByIdAndDelete(req.params.postId);
        res.status(200).json({ message: "Post deleted.", postId: req.params.postId });
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

// ─── FEED ─────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const userId = req.query.userId;
        let followingIds = [], userCategories = [];
        if (userId) {
            const user = await User.findById(userId).select('following');
            if (user) followingIds = user.following.map(id => id.toString());
            const likedPosts = await Post.find({ likes: userId }).select('category').limit(20);
            userCategories = [...new Set(likedPosts.map(p => p.category))];
        }
        const query = cursor ? { _id: { $lt: cursor } } : {};
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit * 3);
        const scored = posts.map(post => {
            let score = computeScore(post, followingIds);
            if (userCategories.includes(post.category)) score += 15;
            return { post, score };
        }).sort((a, b) => b.score - a.score);
        const result = scored.slice(0, limit).map(s => s.post);
        const hasMore = posts.length >= limit;
        const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;
        res.status(200).json({ posts: result, nextCursor, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── USER POSTS (profile page) ────────────────────────────────────────────────
router.get("/user/:userId", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const cursor = req.query.cursor;
        const query = { 'user._id': req.params.userId, ...(cursor ? { _id: { $lt: cursor } } : {}) };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit + 1);
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;
        res.status(200).json({ posts: result, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SAVE / UNSAVE ────────────────────────────────────────────────────────────
router.post("/save", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!postId || !userId) return res.status(400).json({ message: 'Both required.' });
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const alreadySaved = (user.savedPosts || []).some(id => id.toString() === postId);
        if (alreadySaved) {
            await User.findByIdAndUpdate(userId, { $pull: { savedPosts: postId } });
            return res.status(200).json({ saved: false });
        } else {
            await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } });
            return res.status(200).json({ saved: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET SAVED POSTS ──────────────────────────────────────────────────────────
router.get("/saved/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('savedPosts');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const posts = await Post.find({ _id: { $in: user.savedPosts } }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── TRENDING ─────────────────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trending = await Post.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: '$category', postCount: { $sum: 1 }, totalLikes: { $sum: { $size: '$likes' } }, totalComments: { $sum: { $size: '$comments' } } } },
            { $addFields: { score: { $add: ['$totalLikes', { $multiply: ['$totalComments', 2] }, '$postCount'] } } },
            { $sort: { score: -1 } },
            { $limit: 10 },
            { $project: { category: '$_id', postCount: 1, totalLikes: 1, totalComments: 1, score: 1, _id: 0 } }
        ]);
        res.status(200).json(trending);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── LIKE / UNLIKE ────────────────────────────────────────────────────────────
router.post("/like", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!userId || !postId) return res.status(400).json({ message: 'Both required.' });
        const post = await Post.findById(postId);
        if (!post.likes.includes(userId)) {
            post.likes.push(userId);
            post.score = computeScore(post);
            await post.save();
            res.status(200).json({ message: "Success" });
        } else { res.status(400).json({ message: "Already liked." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/unlike", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!userId || !postId) return res.status(400).json({ message: 'Both required.' });
        const post = await Post.findById(postId);
        if (post.likes.includes(userId)) {
            await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
            post.likes = post.likes.filter(id => id.toString() !== userId);
            post.score = computeScore(post);
            await post.save();
            res.status(200).json({ message: "success" });
        } else { res.status(400).json({ message: "Not liked." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
    try {
        const postId = req.headers.authorization;
        if (!postId) return res.status(400).json({ error: 'postId required' });
        const comments = await Comment.find({ postId });
        res.status(200).json(comments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/comments/add', async (req, res) => {
    try {
        const { content, postId, user } = req.body;
        if (!content || !postId || !user) return res.status(400).json({ error: 'Invalid data' });
        const newComment = new Comment({ postId, content, user });
        await newComment.save();
        const post = await Post.findById(postId);
        post.comments.push(newComment._id);
        post.score = computeScore(post);
        await post.save();
        return res.status(200).json(newComment);
    } catch (error) { return res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;