const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const verifyToken = require('../middleware/Verifytoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Story = require('../models/Story');
const Notification = require('../models/Notification');

// ─── GET POSTS I CREATED ──────────────────────────────────────────────────────
router.get('/posts', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const userId = new mongoose.Types.ObjectId(req.userId);
        const posts = await Post.find({ 'user._id': userId, isAnonymous: { $ne: true } })
            .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
            .select('image_url image_urls video videoThumbnail caption createdAt likes shares');
        const total = await Post.countDocuments({ 'user._id': userId, isAnonymous: { $ne: true } });
        res.json({ posts, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET SAVED POSTS ──────────────────────────────────────────────────────────
router.get('/saved', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('savedPosts').lean();
        const postIds = (user?.savedPosts || []).slice().reverse();
        const posts = await Post.find({ _id: { $in: postIds }, isAnonymous: { $ne: true } })
            .select('image_url image_urls video videoThumbnail caption createdAt likes user').lean();
        const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
        const ordered = postIds.map(id => postMap[id.toString()]).filter(Boolean);
        res.json({ posts: ordered });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET POSTS I LIKED ────────────────────────────────────────────────────────
router.get('/liked', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const userId = new mongoose.Types.ObjectId(req.userId);
        const posts = await Post.find({ likes: userId, isAnonymous: { $ne: true } })
            .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
            .select('image_url image_urls video videoThumbnail caption createdAt likes user');
        const total = await Post.countDocuments({ likes: userId, isAnonymous: { $ne: true } });
        res.json({ posts, total, page: Number(page) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET COMMENTS I MADE ──────────────────────────────────────────────────────
router.get('/comments', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const userId = new mongoose.Types.ObjectId(req.userId);
        const comments = await Comment.find({ 'user._id': userId })
            .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
            .populate('postId', 'image_url image_urls video caption user').lean();
        const total = await Comment.countDocuments({ 'user._id': userId });
        res.json({ comments, total, page: Number(page) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET STORY ARCHIVE (including expired) ────────────────────────────────────
router.get('/stories', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const userId = new mongoose.Types.ObjectId(req.userId);
        const stories = await Story.find({ 'user._id': userId })
            .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
        const total = await Story.countDocuments({ 'user._id': userId });
        const now = new Date();
        const enriched = stories.map(s => ({ ...s, isExpired: s.expiresAt && new Date(s.expiresAt) < now }));
        res.json({ stories: enriched, total, page: Number(page) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET INTERACTIONS RECEIVED ────────────────────────────────────────────────
router.get('/interactions', verifyToken, async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const filter = { recipient: req.userId };
        if (type && ['like', 'comment', 'follow', 'mention'].includes(type)) {
            filter.type = type;
        } else {
            filter.type = { $in: ['like', 'comment', 'follow', 'mention'] };
        }
        const interactions = await Notification.find(filter)
            .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
        const total = await Notification.countDocuments(filter);
        res.json({ interactions, total, page: Number(page) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET MUTED USERS LIST ─────────────────────────────────────────────────────
router.get('/muted', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('mutedUsers mutedPosts mutedStories')
            .populate('mutedUsers', 'fullname username profile_picture').lean();
        res.json({ mutedUsers: user?.mutedUsers || [], mutedPosts: user?.mutedPosts || [], mutedStories: user?.mutedStories || [] });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── UNMUTE USER ──────────────────────────────────────────────────────────────
router.delete('/muted/:targetId', verifyToken, async (req, res) => {
    try {
        const targetId = new mongoose.Types.ObjectId(req.params.targetId);
        await User.findByIdAndUpdate(req.userId, { $pull: { mutedUsers: targetId, mutedPosts: targetId, mutedStories: targetId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET NOT INTERESTED POSTS ─────────────────────────────────────────────────
router.get('/not-interested', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('notInterestedPosts')
            .populate('notInterestedPosts', 'image_url image_urls video videoThumbnail caption user createdAt').lean();
        res.json({ posts: (user?.notInterestedPosts || []).reverse() });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── MARK NOT INTERESTED / UNDO ───────────────────────────────────────────────
router.post('/not-interested/:postId', verifyToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $addToSet: { notInterestedPosts: req.params.postId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/not-interested/:postId', verifyToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $pull: { notInterestedPosts: req.params.postId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── INTERESTED POSTS ─────────────────────────────────────────────────
router.get('/interested', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('interestedPosts')
            .populate('interestedPosts', 'image_url image_urls video videoThumbnail caption user createdAt').lean();
        res.json({ posts: (user?.interestedPosts || []).reverse() });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/interested/:postId', verifyToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $addToSet: { interestedPosts: req.params.postId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/interested/:postId', verifyToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $pull: { interestedPosts: req.params.postId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET TIME SPENT STATS ─────────────────────────────────────────────────────
router.get('/time-spent', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('usageStats').lean();
        const today = new Date();
        const stats = user?.usageStats || [];
        const last30 = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const found = stats.find(s => s.date === key);
            last30.push({ date: key, durationSeconds: found?.durationSeconds || 0 });
        }
        res.json({ stats: last30 });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── RECORD SESSION DURATION ──────────────────────────────────────────────────
router.post('/time-spent', verifyToken, async (req, res) => {
    try {
        const { durationSeconds } = req.body;
        if (!durationSeconds || durationSeconds < 5) return res.json({ success: true });
        const today = new Date().toISOString().split('T')[0];
        const user = await User.findById(req.userId).select('usageStats');
        const existing = user.usageStats.find(s => s.date === today);
        if (existing) {
            existing.durationSeconds = (existing.durationSeconds || 0) + Number(durationSeconds);
        } else {
            if (user.usageStats.length >= 90) user.usageStats.shift();
            user.usageStats.push({ date: today, durationSeconds: Number(durationSeconds) });
        }
        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET ACCOUNT ACTIVITY ─────────────────────────────────────────────────────
router.get('/account', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('following followers blockedUsers')
            .populate('following', 'fullname username profile_picture isOnline')
            .populate('followers', 'fullname username profile_picture isOnline')
            .populate('blockedUsers', 'fullname username profile_picture').lean();
        res.json({ following: user?.following || [], followers: user?.followers || [], blockedUsers: user?.blockedUsers || [] });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── UNBLOCK USER ─────────────────────────────────────────────────────────────
router.delete('/blocked/:targetId', verifyToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: req.params.targetId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
