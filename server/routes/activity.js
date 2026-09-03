const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const verifyToken = require('../middleware/Verifytoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Story = require('../models/Story');
const Notification = require('../models/Notification');

const encodeCursor = (date, id) => {
    if (!date || !id) return null;
    return Buffer.from(`${new Date(date).getTime()}_${id.toString()}`).toString('base64');
};

const decodeCursor = (cursorStr) => {
    try {
        if (!cursorStr) return null;
        const decoded = Buffer.from(cursorStr, 'base64').toString('ascii');
        const [timestamp, id] = decoded.split('_');
        if (!timestamp || !id) return null;
        return { date: new Date(parseInt(timestamp, 10)), id };
    } catch (err) {
        return null;
    }
};

const parseLimit = (value, fallback = 20, max = 50) => {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, 1), max);
};

const applyDateCursor = (baseQuery, cursor) => {
    if (!cursor) return baseQuery;
    const decoded = decodeCursor(cursor);
    if (!decoded) return baseQuery;
    return {
        ...baseQuery,
        $or: [
            { createdAt: { $lt: decoded.date } },
            { createdAt: decoded.date, _id: { $lt: decoded.id } }
        ]
    };
};

// ─── GET POSTS I CREATED ──────────────────────────────────────────────────────
router.get('/posts', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const cursor = req.query.cursor;
        const page = Number(req.query.page || 1);
        const userId = new mongoose.Types.ObjectId(req.userId);

        if (cursor) {
            const decoded = decodeCursor(cursor);
            const query = applyDateCursor({ 'user._id': userId, isAnonymous: { $ne: true } }, cursor);
            const posts = await Post.find(query)
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .select('image_url image_urls video videoThumbnail caption createdAt likes shares');
            const hasMore = posts.length > limit;
            const result = hasMore ? posts.slice(0, limit) : posts;
            const nextCursor = hasMore && result[result.length - 1] ? encodeCursor(result[result.length - 1].createdAt, result[result.length - 1]._id) : null;
            const total = await Post.countDocuments({ 'user._id': userId, isAnonymous: { $ne: true } });
            return res.json({ posts: result, total, nextCursor, hasMore, page, limit });
        }

        const skip = (page - 1) * limit;
        const posts = await Post.find({ 'user._id': userId, isAnonymous: { $ne: true } })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
            .select('image_url image_urls video videoThumbnail caption createdAt likes shares');
        const total = await Post.countDocuments({ 'user._id': userId, isAnonymous: { $ne: true } });
        res.json({ posts, total, page: Number(page), pages: Math.ceil(total / limit), nextCursor: posts.length === limit && page * limit < total ? encodeCursor(posts[posts.length - 1].createdAt, posts[posts.length - 1]._id) : null, hasMore: page * limit < total });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET SAVED POSTS ──────────────────────────────────────────────────────────
router.get('/saved', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const user = await User.findById(req.userId).select('savedPosts').lean();
        const postIds = (user?.savedPosts || []).slice().reverse();

        if (req.query.cursor) {
            const cursorId = String(req.query.cursor);
            const index = postIds.findIndex(id => id.toString() === cursorId);
            const startIndex = index === -1 ? 0 : index + 1;
            const pageIds = postIds.slice(startIndex, startIndex + limit);
            const hasMore = startIndex + limit < postIds.length;
            const nextCursor = hasMore && pageIds.length ? pageIds[pageIds.length - 1].toString() : null;

            const posts = await Post.find({ _id: { $in: pageIds }, isAnonymous: { $ne: true } })
                .select('image_url image_urls video videoThumbnail caption createdAt likes user').lean();
            const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
            const ordered = pageIds.map(id => postMap[id.toString()]).filter(Boolean);
            return res.json({ posts: ordered, nextCursor, hasMore, total: postIds.length, limit });
        }

        const pageIds = postIds.slice(0, limit);
        const posts = await Post.find({ _id: { $in: pageIds }, isAnonymous: { $ne: true } })
            .select('image_url image_urls video videoThumbnail caption createdAt likes user').lean();
        const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
        const ordered = pageIds.map(id => postMap[id.toString()]).filter(Boolean);
        const hasMore = postIds.length > limit;
        res.json({ posts: ordered, total: postIds.length, nextCursor: hasMore && pageIds.length ? pageIds[pageIds.length - 1].toString() : null, hasMore, limit });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET POSTS I LIKED ────────────────────────────────────────────────────────
router.get('/liked', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = Number(req.query.page || 1);
        const cursor = req.query.cursor;
        const userId = new mongoose.Types.ObjectId(req.userId);

        if (cursor) {
            const query = applyDateCursor({ likes: userId, isAnonymous: { $ne: true } }, cursor);
            const posts = await Post.find(query)
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .select('image_url image_urls video videoThumbnail caption createdAt likes user');
            const hasMore = posts.length > limit;
            const result = hasMore ? posts.slice(0, limit) : posts;
            const nextCursor = hasMore && result[result.length - 1] ? encodeCursor(result[result.length - 1].createdAt, result[result.length - 1]._id) : null;
            const total = await Post.countDocuments({ likes: userId, isAnonymous: { $ne: true } });
            return res.json({ posts: result, total, nextCursor, hasMore, page, limit });
        }

        const skip = (page - 1) * limit;
        const posts = await Post.find({ likes: userId, isAnonymous: { $ne: true } })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
            .select('image_url image_urls video videoThumbnail caption createdAt likes user');
        const total = await Post.countDocuments({ likes: userId, isAnonymous: { $ne: true } });
        res.json({ posts, total, page: Number(page), nextCursor: posts.length === limit && page * limit < total ? encodeCursor(posts[posts.length - 1].createdAt, posts[posts.length - 1]._id) : null, hasMore: page * limit < total, limit });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET COMMENTS I MADE ──────────────────────────────────────────────────────
router.get('/comments', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = Number(req.query.page || 1);
        const cursor = req.query.cursor;
        const userId = new mongoose.Types.ObjectId(req.userId);

        if (cursor) {
            const query = applyDateCursor({ 'user._id': userId }, cursor);
            const comments = await Comment.find(query)
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .populate('postId', 'image_url image_urls video caption user').lean();
            const hasMore = comments.length > limit;
            const result = hasMore ? comments.slice(0, limit) : comments;
            const nextCursor = hasMore && result[result.length - 1] ? encodeCursor(result[result.length - 1].createdAt, result[result.length - 1]._id) : null;
            const total = await Comment.countDocuments({ 'user._id': userId });
            return res.json({ comments: result, total, nextCursor, hasMore, page, limit });
        }

        const skip = (page - 1) * limit;
        const comments = await Comment.find({ 'user._id': userId })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
            .populate('postId', 'image_url image_urls video caption user').lean();
        const total = await Comment.countDocuments({ 'user._id': userId });
        res.json({ comments, total, page: Number(page), nextCursor: comments.length === limit && page * limit < total ? encodeCursor(comments[comments.length - 1].createdAt, comments[comments.length - 1]._id) : null, hasMore: page * limit < total, limit });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET STORY ARCHIVE / LIVE STORIES ─────────────────────────────────────────
router.get('/stories', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = Number(req.query.page || 1);
        const cursor = req.query.cursor;
        const mode = (req.query.mode || 'archived').toLowerCase();
        const userId = new mongoose.Types.ObjectId(req.userId);
        const now = new Date();

        const liveQuery = { 'user._id': userId, expiresAt: { $gt: now } };
        const archiveQuery = {
            'user._id': userId,
            $or: [
                { expiresAt: { $lt: now } },
                { expiresAt: null }
            ]
        };
        const query = mode === 'live' ? liveQuery : archiveQuery;

        if (cursor) {
            const queryWithCursor = applyDateCursor(query, cursor);
            const stories = await Story.find(queryWithCursor)
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .lean();
            const hasMore = stories.length > limit;
            const result = hasMore ? stories.slice(0, limit) : stories;
            const nextCursor = hasMore && result[result.length - 1] ? encodeCursor(result[result.length - 1].createdAt, result[result.length - 1]._id) : null;
            const total = await Story.countDocuments(query);
            const enriched = result.map(s => ({ ...s, isExpired: !!s.expiresAt && new Date(s.expiresAt) < now }));
            return res.json({ stories: enriched, total, nextCursor, hasMore, page, limit, mode });
        }

        const skip = (page - 1) * limit;
        const stories = await Story.find(query)
            .sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
        const total = await Story.countDocuments(query);
        const enriched = stories.map(s => ({ ...s, isExpired: !!s.expiresAt && new Date(s.expiresAt) < now }));
        res.json({
            stories: enriched,
            total,
            page: Number(page),
            nextCursor: stories.length === limit && page * limit < total ? encodeCursor(stories[stories.length - 1].createdAt, stories[stories.length - 1]._id) : null,
            hasMore: page * limit < total,
            limit,
            mode
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET INTERACTIONS RECEIVED ────────────────────────────────────────────────
router.get('/interactions', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = Number(req.query.page || 1);
        const cursor = req.query.cursor;
        const { type } = req.query;
        const filter = { recipient: req.userId };
        if (type && ['like', 'comment', 'follow', 'mention'].includes(type)) {
            filter.type = type;
        } else {
            filter.type = { $in: ['like', 'comment', 'follow', 'mention'] };
        }

        if (cursor) {
            const query = applyDateCursor(filter, cursor);
            const interactions = await Notification.find(query)
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .lean();
            const hasMore = interactions.length > limit;
            const result = hasMore ? interactions.slice(0, limit) : interactions;
            const nextCursor = hasMore && result[result.length - 1] ? encodeCursor(result[result.length - 1].createdAt, result[result.length - 1]._id) : null;
            const total = await Notification.countDocuments(filter);
            return res.json({ interactions: result, total, nextCursor, hasMore, page, limit });
        }

        const skip = (page - 1) * limit;
        const interactions = await Notification.find(filter)
            .sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
        const total = await Notification.countDocuments(filter);
        res.json({ interactions, total, page: Number(page), nextCursor: interactions.length === limit && page * limit < total ? encodeCursor(interactions[interactions.length - 1].createdAt, interactions[interactions.length - 1]._id) : null, hasMore: page * limit < total, limit });
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

// ─── GET NOT INTERESTED POSTS ─────────────────────────────────────────────────
router.get('/not-interested', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const user = await User.findById(req.userId).select('notInterestedPosts').lean();
        const ordered = (user?.notInterestedPosts || []).slice().reverse();
        const cursor = req.query.cursor;

        if (cursor) {
            const cursorId = String(cursor);
            const index = ordered.findIndex(id => id.toString() === cursorId);
            const startIndex = index === -1 ? 0 : index + 1;
            const pageIds = ordered.slice(startIndex, startIndex + limit);
            const hasMore = startIndex + limit < ordered.length;
            const nextCursor = hasMore && pageIds.length ? pageIds[pageIds.length - 1].toString() : null;
            const posts = await Post.find({ _id: { $in: pageIds }, isAnonymous: { $ne: true } })
                .populate('user', 'fullname profile_picture username')
                .lean();
            const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
            const result = pageIds.map(id => postMap[id.toString()]).filter(Boolean);
            return res.json({ posts: result, total: ordered.length, nextCursor, hasMore, limit });
        }

        const pageIds = ordered.slice(0, limit);
        const posts = await Post.find({ _id: { $in: pageIds }, isAnonymous: { $ne: true } })
            .populate('user', 'fullname profile_picture username')
            .lean();
        const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
        const result = pageIds.map(id => postMap[id.toString()]).filter(Boolean);
        const hasMore = ordered.length > limit;
        res.json({ posts: result, total: ordered.length, nextCursor: hasMore && pageIds.length ? pageIds[pageIds.length - 1].toString() : null, hasMore, limit });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── INTERESTED POSTS ─────────────────────────────────────────────────
router.get('/interested', verifyToken, async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const user = await User.findById(req.userId).select('interestedPosts').lean();
        const ordered = (user?.interestedPosts || []).slice().reverse();
        const cursor = req.query.cursor;

        if (cursor) {
            const cursorId = String(cursor);
            const index = ordered.findIndex(id => id.toString() === cursorId);
            const startIndex = index === -1 ? 0 : index + 1;
            const pageIds = ordered.slice(startIndex, startIndex + limit);
            const hasMore = startIndex + limit < ordered.length;
            const nextCursor = hasMore && pageIds.length ? pageIds[pageIds.length - 1].toString() : null;
            const posts = await Post.find({ _id: { $in: pageIds }, isAnonymous: { $ne: true } })
                .populate('user', 'fullname profile_picture username')
                .lean();
            const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
            const result = pageIds.map(id => postMap[id.toString()]).filter(Boolean);
            return res.json({ posts: result, total: ordered.length, nextCursor, hasMore, limit });
        }

        const pageIds = ordered.slice(0, limit);
        const posts = await Post.find({ _id: { $in: pageIds }, isAnonymous: { $ne: true } })
            .populate('user', 'fullname profile_picture username')
            .lean();
        const postMap = Object.fromEntries(posts.map(p => [p._id.toString(), p]));
        const result = pageIds.map(id => postMap[id.toString()]).filter(Boolean);
        const hasMore = ordered.length > limit;
        res.json({ posts: result, total: ordered.length, nextCursor: hasMore && pageIds.length ? pageIds[pageIds.length - 1].toString() : null, hasMore, limit });
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

// ─── INTERESTED POSTS ─────────────────────────────────────────────────
router.get('/interested', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('interestedPosts')
            .populate('interestedPosts', 'image_url image_urls video videoThumbnail caption user createdAt').lean();
        res.json({ posts: (user?.interestedPosts || []).reverse() });
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
